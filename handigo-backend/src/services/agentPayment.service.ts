import { z } from "zod";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import type { RequestUser } from "../middlewares/authContext";
import type { CreatePaymentInput } from "../validations/payment.validator";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { buildOrderPaymentRedirects } from "../utils/paymentRedirect";

export const agentPaymentResultSchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i), orderCode: z.string(),
  status: z.enum(["unpaid", "pending", "paid", "deposit_paid", "cash_pending", "blocked", "failed", "refunded"]),
  message: z.string(), amount: z.number().nonnegative().optional(),
  method: z.string().optional(), paymentType: z.string().optional(),
  checkoutUrl: z.string().url().optional(),
  paymentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
export type AgentPaymentResult = z.infer<typeof agentPaymentResultSchema>;
export type AgentPaymentArguments = { orderId: string; method: CreatePaymentInput["method"] };
export const paymentExpectationSchema = z.object({ amount: z.number().nonnegative(), paymentType: z.enum(["full", "inspection_deposit"]),
  previousPaymentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  previousPaymentMethod: z.enum(["cash", "payos"]).optional() });
export const paymentCancellationExpectationSchema = z.object({ paymentId: z.string().regex(/^[a-f\d]{24}$/i),
  amount: z.number().nonnegative(), paymentType: z.enum(["full", "inspection_deposit"]) });

// Liên kết chỉ lấy từ giao dịch backend, không lấy từ nội dung LLM.
export const safePayosUrl = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "pay.payos.vn" || url.hostname === "payos.vn" || url.hostname.endsWith(".payos.vn")) ? url.href : undefined;
  } catch { return undefined; }
};

const dependencies = {
  order: (user: RequestUser, orderId: string) => Order.findOne({ _id: orderId, customerId: user.id, isDeleted: false }).exec(),
  payments: (orderId: string) => Payment.find({ orderId, isDeleted: false }).sort({ createdAt: -1 }).exec(),
  preview: async (user: RequestUser, args: AgentPaymentArguments) =>
    (await import("./payment.service")).previewOrderPayment(user, args.orderId, args.method, true),
  create: async (user: RequestUser, input: CreatePaymentInput, expected: z.infer<typeof paymentExpectationSchema>, signal?: AbortSignal) =>
    (await import("./payment.service")).createAgentOrderPayment(user, input, expected, signal),
  reconcile: async (user: RequestUser, orderId: string) =>
    (await import("./payment.service")).reconcilePayosPaymentForOrder(orderId, user),
};

const cancellationDependencies = {
  preview: async (user: RequestUser, orderId: string, paymentId?: string) =>
    (await import("./payment.service")).previewAgentPaymentCancellation(user, orderId, paymentId),
  cancel: async (user: RequestUser, orderId: string, expected: z.infer<typeof paymentCancellationExpectationSchema>, actionId: string, signal?: AbortSignal) =>
    (await import("./payment.service")).cancelAgentPendingPayment(user, orderId, expected, actionId, signal),
};

export function createAgentPaymentService(deps = dependencies, cancellation = cancellationDependencies) {
  const ownedOrder = async (user: RequestUser, orderId: string) => {
    if (user.role !== "CUSTOMER") throw new AppError("Thanh toán qua trợ lý chỉ dành cho khách hàng.", 403);
    const order = await deps.order(user, orderId);
    if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
    return order;
  };
  const status = async (user: RequestUser, orderId: string, reconcile = true): Promise<AgentPaymentResult> => {
    let order = await ownedOrder(user, orderId);
    let payments = await deps.payments(orderId);
    if (reconcile && payments.some((payment) => payment.method === "payos" && payment.status === "pending")) {
      await deps.reconcile(user, orderId);
      order = await ownedOrder(user, orderId);
      payments = await deps.payments(orderId);
    }
    const payment = payments.find((item) => ["paid", "pending"].includes(item.status)) ?? payments[0];
    const base = { orderId, orderCode: order.orderCode, amount: payment?.amount,
      method: payment?.method, paymentType: payment?.paymentType, paymentId: payment ? String(payment._id) : undefined };
    if (payment?.status === "paid") return { ...base,
      status: payment.paymentType === "inspection_deposit" ? "deposit_paid" : "paid",
      message: payment.paymentType === "inspection_deposit"
        ? "Đã thanh toán tiền cọc. Chi phí sau khảo sát trả trực tiếp cho thợ."
        : "Đã thanh toán thành công." };
    if (payment?.status === "refunded") return { ...base, status: "refunded", message: "Giao dịch đã được hoàn tiền. Xem chi tiết trong đơn hàng." };
    if (order.status === "cancelled" || order.status === "completed") return { ...base, status: "blocked",
      message: "Đơn đã kết thúc hoặc bị hủy, không thể thanh toán thêm. Bạn có thể xem chi tiết đơn." };
    if (payment?.status === "failed" && payment.metadata?.customerCancelledQr === true) return { ...base, status: "failed",
      message: "Đã hủy giao dịch QR thanh toán. Đơn hàng được giữ theo thời hạn hiện tại. Bạn có thể chọn thanh toán lại hoặc phương thức khác." };
    if (payment?.status === "pending") {
      if (payment.method === "cash") return { ...base, status: "cash_pending", message: "Đã chọn tiền mặt, chưa thanh toán. Bạn trả trực tiếp cho thợ." };
      const link = payment.gatewayResponse?.paymentLink as { checkoutUrl?: unknown } | undefined;
      return { ...base, status: "pending", checkoutUrl: safePayosUrl(link?.checkoutUrl),
        message: "Đang chờ thanh toán. Bạn quét mã QR bên dưới để thanh toán." };
    }
    if (["scheduled", "recurring"].includes(order.orderType)
      && !(order.status === "in_progress" && !order.inspectionRequired && order.paymentStatus === "unpaid")
      && !(order.status === "created" && !order.providerId && order.bookingStatus !== "reserved")
      && (order.status !== "accepted" || order.bookingStatus !== "awaiting_payment" || !order.providerId)) {
      return { ...base, status: "blocked", message: "Lịch hẹn đang chờ thợ xác nhận, chưa đến bước thanh toán." };
    }
    return { ...base, status: payment?.status === "failed" ? "failed" : "unpaid",
      message: payment?.status === "failed" ? "Giao dịch cũ không thành công. Bạn có thể chọn phương thức để thanh toán lại."
        : "Đơn chưa thanh toán. Vui lòng chọn phương thức phù hợp." };
  };
  return {
    status,
    async previewCancellation(user: RequestUser, orderId: string, paymentId?: string) {
      await ownedOrder(user, orderId);
      return cancellation.preview(user, orderId, paymentId);
    },
    async cancel(user: RequestUser, orderId: string, confirmed: unknown, actionId: string, signal?: AbortSignal): Promise<AgentPaymentResult> {
      await ownedOrder(user, orderId);
      const expected = paymentCancellationExpectationSchema.parse(confirmed);
      try {
        await cancellation.cancel(user, orderId, expected, actionId, signal);
      } catch (error) {
        if (!(error instanceof ActionPreconditionError) && !(error instanceof AppError && error.statusCode < 500)) throw error;
        const current = await status(user, orderId, false);
        return { ...current, message: [error.message, current.message].join(" ") };
      }
      return status(user, orderId, false);
    },
    async cancellationConfirmed(user: RequestUser, result: AgentPaymentResult, paymentId: string) {
      await ownedOrder(user, result.orderId);
      if (result.paymentId !== paymentId || result.method !== "payos") return false;
      const payment = (await deps.payments(result.orderId)).find((item) => String(item._id) === paymentId);
      if (!payment || payment.amount !== result.amount || payment.paymentType !== result.paymentType) return false;
      if (payment.status === "paid" || payment.status === "refunded") return true;
      const gateway = z.object({ status: z.string(), amountPaid: z.number() }).safeParse(
        payment.gatewayResponse?.statusCheck ?? payment.gatewayResponse?.reconciliation);
      return payment.status === "failed" && (payment.metadata?.customerCancelledQr === true
        || gateway.success && ["CANCELLED", "EXPIRED", "FAILED"].includes(gateway.data.status) && gateway.data.amountPaid === 0);
    },
    async failureConfirmed(user: RequestUser, result: AgentPaymentResult, startedAt: string) {
      if (!result.paymentId || !["failed", "refunded"].includes(result.status)) return false;
      await ownedOrder(user, result.orderId);
      const payments = await deps.payments(result.orderId);
      const payment = payments.find((item) => String(item._id) === result.paymentId);
      // Không dùng giao dịch thất bại của lượt cũ để mở khóa một thao tác vẫn chưa rõ kết quả.
      return Boolean(payment && payment.status === result.status && payment.amount === result.amount
        && payment.method === result.method && payment.paymentType === result.paymentType
        && payment.createdAt && payment.createdAt.getTime() >= Date.parse(startedAt)
        && !payments.some((item) => item.status === "pending" || item.status === "paid"));
    },
    async preview(user: RequestUser, args: AgentPaymentArguments) {
      await ownedOrder(user, args.orderId);
      return deps.preview(user, args);
    },
    async pay(user: RequestUser, args: AgentPaymentArguments, confirmed: unknown, signal?: AbortSignal): Promise<AgentPaymentResult> {
      const order = await ownedOrder(user, args.orderId);
      const expected = paymentExpectationSchema.parse(confirmed);
      let executionStarted = false;
      try {
        const current = await deps.preview(user, args);
        if (current.amount !== expected.amount || current.paymentType !== expected.paymentType
          || current.previousPaymentId !== expected.previousPaymentId
          || current.previousPaymentMethod !== expected.previousPaymentMethod) throw new ActionPreconditionError();
        // URL trở về lấy từ cấu hình server, tuyệt đối không cho LLM chọn tên miền.
        const redirectUrls = buildOrderPaymentRedirects(args.orderId, process.env.FRONTEND_URL?.trim() || "https://localhost:5173", {
          returnUrl: process.env.PAYOS_RETURN_URL, cancelUrl: process.env.PAYOS_CANCEL_URL,
        });
        executionStarted = true;
        await deps.create(user, { ...args,
          paymentType: expected.paymentType === "inspection_deposit" ? "INSPECTION_DEPOSIT" : "FULL",
          ...redirectUrls,
        }, expected, signal);
      } catch (error) {
        if (error instanceof ActionPreconditionError || (!executionStarted && error instanceof AppError && error.statusCode < 500)) {
          return { orderId: args.orderId, orderCode: order.orderCode, status: "blocked", message: error.message };
        }
        throw error;
      }
      return status(user, args.orderId, false);
    },
  };
}
export const AgentPaymentService = createAgentPaymentService();
