import { z } from "zod";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import type { RequestUser } from "../middlewares/authContext";
import type { CreatePaymentInput } from "../validations/payment.validator";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";

export const agentPaymentResultSchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i), orderCode: z.string(),
  status: z.enum(["unpaid", "pending", "paid", "deposit_paid", "cash_pending", "blocked", "failed", "refunded"]),
  message: z.string(), amount: z.number().nonnegative().optional(),
  method: z.string().optional(), paymentType: z.string().optional(),
  checkoutUrl: z.string().url().optional(),
});
export type AgentPaymentResult = z.infer<typeof agentPaymentResultSchema>;
export type AgentPaymentArguments = { orderId: string; method: CreatePaymentInput["method"] };
export const paymentExpectationSchema = z.object({ amount: z.number().positive(), paymentType: z.enum(["full", "inspection_deposit"]) });

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
    (await import("./payment.service")).previewOrderPayment(user, args.orderId, args.method),
  create: async (user: RequestUser, input: CreatePaymentInput, expected: z.infer<typeof paymentExpectationSchema>) =>
    (await import("./payment.service")).createPayment(user, input, expected),
  reconcile: async (user: RequestUser, orderId: string) =>
    (await import("./payment.service")).reconcilePayosPaymentForOrder(orderId, user),
};

export function createAgentPaymentService(deps = dependencies) {
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
      method: payment?.method, paymentType: payment?.paymentType };
    if (payment?.status === "paid") return { ...base,
      status: payment.paymentType === "inspection_deposit" ? "deposit_paid" : "paid",
      message: payment.paymentType === "inspection_deposit"
        ? "Đã xác minh thanh toán tiền cọc. Chi phí báo giá sau khảo sát được thanh toán trực tiếp với nhà cung cấp."
        : "Đã xác minh thanh toán thành công cho đơn hàng." };
    if (payment?.status === "refunded") return { ...base, status: "refunded", message: "Giao dịch đã được hoàn tiền. Xem chi tiết trong đơn hàng." };
    if (order.status === "cancelled" || order.status === "completed") return { ...base, status: "blocked",
      message: "Đơn đã kết thúc hoặc bị hủy. Không tạo thanh toán mới; kiểm tra chi tiết đơn nếu cần đối soát." };
    if (payment?.status === "pending") {
      if (payment.method === "cash") return { ...base, status: "cash_pending", message: "Đã ghi nhận thanh toán tiền mặt. Bạn thanh toán trực tiếp cho nhà cung cấp; đơn chưa được đánh dấu đã thanh toán." };
      const link = payment.gatewayResponse?.paymentLink as { checkoutUrl?: unknown } | undefined;
      return { ...base, status: "pending", checkoutUrl: safePayosUrl(link?.checkoutUrl),
        message: "Giao dịch đang chờ thanh toán. Mở PayOS để thanh toán hoặc hủy giao dịch trước khi đổi phương thức, sau đó chọn Kiểm tra thanh toán. Không tạo đơn mới." };
    }
    if (["scheduled", "recurring"].includes(order.orderType)
      && (order.status !== "accepted" || order.bookingStatus !== "awaiting_payment" || !order.providerId)) {
      return { ...base, status: "blocked", message: "Lịch hẹn đang chờ chuyên gia xác nhận. Chỉ thanh toán khi đơn chuyển sang chờ thanh toán." };
    }
    return { ...base, status: payment?.status === "failed" ? "failed" : "unpaid",
      message: payment?.status === "failed" ? "Giao dịch cũ đã hủy, hết hạn hoặc thất bại. Bạn có thể chọn phương thức thanh toán lại trên cùng đơn."
        : "Đơn chưa có giao dịch thanh toán. Bạn có thể chọn chuyển khoản, ví hoặc tiền mặt nếu dịch vụ cho phép." };
  };
  return {
    status,
    async preview(user: RequestUser, args: AgentPaymentArguments) {
      await ownedOrder(user, args.orderId);
      return deps.preview(user, args);
    },
    async pay(user: RequestUser, args: AgentPaymentArguments, confirmed: unknown): Promise<AgentPaymentResult> {
      const order = await ownedOrder(user, args.orderId);
      const expected = paymentExpectationSchema.parse(confirmed);
      let executionStarted = false;
      try {
        const current = await deps.preview(user, args);
        if (current.amount !== expected.amount || current.paymentType !== expected.paymentType) throw new ActionPreconditionError();
        // URL trở về lấy từ cấu hình server, tuyệt đối không cho LLM chọn tên miền.
        const frontend = process.env.FRONTEND_URL?.trim();
        const detailUrl = frontend ? new URL(`/customer/bookings/${args.orderId}`, frontend).href : undefined;
        executionStarted = true;
        await deps.create(user, { ...args,
          paymentType: expected.paymentType === "inspection_deposit" ? "INSPECTION_DEPOSIT" : "FULL",
          ...(detailUrl ? { returnUrl: detailUrl, cancelUrl: detailUrl } : {}),
        }, expected);
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
