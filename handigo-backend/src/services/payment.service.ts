import mongoose, { Types } from "mongoose";
import { payos } from "../configs/payos.config";
import type { ClientSession } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";
import { Order } from "../models/order.model";
import { Payment, PaymentType } from "../models/payment.model";
import { Promotion } from "../models/promotion.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Refund } from "../models/refund.model";
import { createNotificationRecord, emitRealtimeNotification } from "./notification.service";
import type { CreatePaymentInput, PaymentHistoryQuery } from "../validations/payment.validator";
import { handleWalletDepositPayosWebhook } from "./wallet.service";
import { buildTransactionCode, withTransactionRetry } from "../utils/transaction";
import { createLogger } from "../utils/logger";
import { markOrderVoucherAsUsed } from "./voucher.service";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { publishPaymentStatus } from "./paymentStatus.service";
import { buildOrderPaymentRedirects, resolvePaymentFrontendOrigin } from "../utils/paymentRedirect";

export interface ConfirmedPaymentExpectation {
  amount: number;
  paymentType: PaymentType;
  previousPaymentId?: string;
  previousPaymentMethod?: "cash" | "payos";
}

export interface ConfirmedPaymentCancellation {
  paymentId: string;
  amount: number;
  paymentType: "full" | "inspection_deposit";
}

const isFixedPriceWorkPayment = (order: InstanceType<typeof Order>) =>
  !order.inspectionRequired && order.status === "in_progress" && order.paymentStatus === "unpaid";

// Kiểm tra lại bên trong transaction để số tiền trừ đúng với bản khách đã xác nhận.
const assertConfirmedPayment = (order: InstanceType<typeof Order>, amount: number,
  paymentType: PaymentType, expected?: ConfirmedPaymentExpectation) => {
  if (!expected) return;
  if (expected.amount !== amount || expected.paymentType !== paymentType
    || (!["created", "accepted"].includes(order.status) && !isFixedPriceWorkPayment(order))
    || order.paymentStatus !== "unpaid") {
    throw new ActionPreconditionError();
  }
};

const paymentLogger = createLogger("PaymentService");

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const rethrowDuplicatePaymentError = (error: unknown): never => {
  if (isDuplicateKeyError(error)) {
    throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
  }

  throw error;
};

const getPendingPayosLink = (payment: InstanceType<typeof Payment>) => {
  const gatewayResponse = payment.gatewayResponse as
    | {
        paymentLink?: {
          checkoutUrl?: string;
          qrCode?: string;
        };
      }
    | null
    | undefined;
  return gatewayResponse?.paymentLink;
};

const reconcileExistingPendingPayosPayment = async (
  payment: InstanceType<typeof Payment>,
) => {
  if (!payment.gatewayOrderCode) {
    throw new AppError("Giao dịch PayOS đang chờ xử lý nhưng thiếu mã đối soát", 409);
  }

  let paymentLink;
  try {
    paymentLink = await payos.paymentRequests.get(
      Number(payment.gatewayOrderCode),
    );
  } catch (error: unknown) {
    paymentLogger.error("Không thể kiểm tra trạng thái giao dịch PayOS.", error, {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
    });
    throw new AppError(
      "Không thể kiểm tra trạng thái giao dịch PayOS. Vui lòng thử lại sau.",
      502,
    );
  }

  if (["CANCELLED", "EXPIRED", "FAILED"].includes(paymentLink.status)) {
    if (!Number.isFinite(Number(paymentLink.amountPaid || 0)) || Number(paymentLink.amountPaid || 0) !== 0) {
      throw new AppError("PayOS đã nhận tiền. Cần đối soát giao dịch trước khi thanh toán lại.", 409);
    }
    const failureReason =
      paymentLink.status === "CANCELLED"
        ? "Khách hàng đã hủy thanh toán trên PayOS"
        : paymentLink.status === "EXPIRED"
          ? "Liên kết thanh toán PayOS đã hết hạn"
          : "Thanh toán PayOS thất bại";

    const transition = await Payment.updateOne(
      { _id: payment._id, status: "pending", isDeleted: false },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          failureReason,
          gatewayResponse: {
            ...((payment.gatewayResponse as Record<string, unknown>) || {}),
            statusCheck: {
              status: paymentLink.status,
              cancellationReason: paymentLink.cancellationReason,
              canceledAt: paymentLink.canceledAt,
              checkedAt: new Date(),
            },
          },
        },
      },
    );
    if (transition.modifiedCount === 0) {
      const currentPayment = await Payment.findById(payment._id).select("status");
      if (currentPayment?.status !== "failed") {
        throw new AppError(
          "Trạng thái giao dịch vừa được cập nhật. Vui lòng tải lại đơn hàng.",
          409,
        );
      }
    }
    return null;
  }

  if (paymentLink.status !== "PENDING") {
    throw new AppError(
      "Giao dịch PayOS đang được xử lý. Vui lòng chờ hệ thống cập nhật trạng thái.",
      409,
    );
  }

  return getPendingPayosLink(payment);
};

const triggerDispatch = (orderId: string) => {
  import("./dispatch.service")
    .then(({ DispatchService }) => DispatchService.dispatchReadyOrder(orderId))
    .catch((error: unknown) =>
      paymentLogger.error("Không thể khởi động điều phối sau thanh toán.", error, {
        orderId,
      }),
    );
};

const triggerCancelledOrderSettlement = (orderId: string) => {
  import("./orderCancellation.service")
    .then(({ settleCancelledOrderPayments }) =>
      settleCancelledOrderPayments(
        orderId,
        "Thanh toán PayOS được ghi nhận sau khi đơn hàng đã hủy",
      ),
    )
    .catch((error: unknown) =>
      paymentLogger.error(
        "Không thể xử lý thanh toán PayOS đến sau khi đơn đã hủy.",
        error,
        { orderId },
      ),
    );
};

const assertAppointmentPaymentReady = (
  order: InstanceType<typeof Order>,
  paymentType?: PaymentType,
) => {
  if (paymentType === "remaining") return;
  if (isFixedPriceWorkPayment(order)) return;
  if (order.orderType !== "scheduled") return;
  if (order.status === "created" && !order.providerId) return;
  if (
    order.inspectionRequired &&
    order.status === "created" &&
    order.bookingStatus === "awaiting_payment"
  ) {
    if (order.paymentDueAt && order.paymentDueAt <= new Date()) {
      throw new AppError("Thời hạn thanh toán giữ lịch đã kết thúc.", 409);
    }
    return;
  }
  if (
    order.status !== "accepted" ||
    order.bookingStatus !== "awaiting_payment" ||
    !order.providerId
  ) {
    throw new AppError(
      "Chỉ có thể thanh toán sau khi chuyên gia xác nhận lịch hẹn.",
      409,
    );
  }
  if (order.paymentDueAt && order.paymentDueAt <= new Date()) {
    throw new AppError("Thời hạn thanh toán giữ lịch đã kết thúc.", 409);
  }
};

const buildPayosOrderCode = () =>
  Number(`${Date.now()}${Math.floor(Math.random() * 100)}`.slice(-11)) * 10 + 1;

const getPaymentType = (
  order: any,
  requestedType?: "INSPECTION_DEPOSIT" | "FULL" | "REMAINING",
): PaymentType => {
  if (requestedType === "REMAINING") {
    throw new AppError(
      "Dịch vụ báo giá chỉ thanh toán tiền cọc qua Handigo. Chi phí báo giá được khách hàng và provider tự thanh toán trực tiếp.",
      400,
    );
  }

  if (order.inspectionRequired) {
    return "inspection_deposit";
  }

  return "full";
};

const getPaymentAmount = async (
  order: any,
  paymentType: PaymentType,
) => {
  if (paymentType === "remaining") {
    throw new AppError(
      "Dịch vụ báo giá không thanh toán chi phí báo giá qua Handigo.",
      400,
    );
  }

  if (paymentType === "full") {
    return Math.max(order.pricing?.totalPaidAmount ?? order.pricing?.bookingAmount ?? 0, 0);
  }

  const depositAmount = order.depositAmount || 0;

  if (depositAmount <= 0) {
    throw new AppError("Dịch vụ khảo sát chưa cấu hình tiền đặt cọc", 400);
  }

  return order.pricing?.baseAmount !== undefined ? order.pricing.totalPaidAmount : depositAmount;
};

const canAccessOrder = async (order: any, user: RequestUser) => {
  if (user.role === "ADMIN") {
    return true;
  }

  if (order.customerId?.toString() === user.id) {
    return true;
  }

  if (!order.providerId) {
    return false;
  }

  const provider = await Provider.findById(order.providerId).select("userId");
  return provider?.userId?.toString() === user.id;
};

const createWalletPayment = async (order: any, paymentType: PaymentType, amount: number, expected?: ConfirmedPaymentExpectation, previousCashPaymentId?: string) => {
  const session = await mongoose.startSession();
  let payment: InstanceType<typeof Payment> | null = null;
  let paymentOrder: any = null;
  let chargedAmount = amount;
  let shouldDispatch = false;

  try {
    payment = (await session.withTransaction(async () => {
      const transactionalOrder = await Order.findById(order._id).session(session);
      if (!transactionalOrder || transactionalOrder.isDeleted) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }
      assertAppointmentPaymentReady(transactionalOrder, paymentType);

      chargedAmount = await getPaymentAmount(transactionalOrder, paymentType);
      assertConfirmedPayment(transactionalOrder, chargedAmount, paymentType, expected);
      const waivedDeposit = chargedAmount === 0 && paymentType === "inspection_deposit" &&
        transactionalOrder.inspectionRequired && transactionalOrder.voucherSnapshot &&
        (transactionalOrder.pricing.baseAmount ?? 0) > 0 &&
        transactionalOrder.pricing.voucherDiscountAmount === transactionalOrder.pricing.baseAmount &&
        await Promotion.exists({ _id: transactionalOrder.voucherSnapshot.voucherId,
          ownerId: transactionalOrder.customerId, applicableOrderType: "variable_price",
          discountType: "PERCENT", discountValue: 100, isDeleted: false }).session(session);
      if (chargedAmount < 0 || (chargedAmount === 0 && !waivedDeposit)) {
        throw new AppError("Số tiền thanh toán không hợp lệ", 400);
      }

      const duplicatePayment = await Payment.findOne({
        orderId: transactionalOrder._id,
        paymentType,
        status: { $in: ["pending", "paid"] },
        isDeleted: false,
      }).session(session);
      const switchingCash = previousCashPaymentId === String(duplicatePayment?._id)
        && duplicatePayment?.method === "cash" && duplicatePayment.status === "pending";
      if (previousCashPaymentId && !switchingCash) throw new ActionPreconditionError();
      if (duplicatePayment && !switchingCash) {
        throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
      }
      if (waivedDeposit && (!['created', 'accepted'].includes(transactionalOrder.status) ||
        transactionalOrder.paymentStatus !== "unpaid")) {
        throw new AppError("Đơn không còn chờ xác nhận miễn phí cọc.", 409);
      }

      const wallet = waivedDeposit ? null : await Wallet.findOneAndUpdate(
        {
          userId: transactionalOrder.customerId,
          isDeleted: false,
          balance: { $gte: chargedAmount },
        },
        { $inc: { balance: -chargedAmount } },
        { new: true, session },
      );

      if (!wallet && !waivedDeposit) {
        throw new AppError("Số dư ví không đủ để thanh toán", 400);
      }

      const transactionCode = buildTransactionCode("PAYMENT");
      const paymentData = {
        orderId: transactionalOrder._id, customerId: transactionalOrder.customerId,
        amount: chargedAmount, method: "wallet", paymentType, status: "paid", transactionCode, paidAt: new Date(),
      };
      const createdPayment = switchingCash ? await Payment.findOneAndUpdate({
        _id: duplicatePayment!._id, method: "cash", status: "pending", isDeleted: false,
      }, { $set: { ...paymentData, "metadata.previousMethod": "cash", "metadata.methodChangedAt": new Date() } },
      { new: true, session, runValidators: true }) : (await Payment.create(
        [
          {
            orderId: transactionalOrder._id,
            customerId: transactionalOrder.customerId,
            amount: chargedAmount,
            method: "wallet",
            paymentType,
            status: "paid",
            transactionCode,
            paidAt: new Date(),
            ...(waivedDeposit ? { metadata: { note: "Phí cọc được miễn bằng mã đổi điểm, không trừ tiền ví." } } : {}),
          },
        ],
        { session },
      ))[0];
      if (!createdPayment) throw new ActionPreconditionError();

      if (wallet) await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: transactionalOrder.customerId,
            relatedOrderId: transactionalOrder._id,
            relatedPaymentId: createdPayment._id,
            type: "payment",
            direction: "out",
            amount: chargedAmount,
            balanceAfter: wallet.balance,
            status: "success",
            transactionCode,
            description: "Thanh toán đơn hàng bằng ví Handigo",
            metadata: { orderCode: transactionalOrder.orderCode },
          },
        ],
        { session },
      );

      if (paymentType === "inspection_deposit") {
        if (transactionalOrder.pricing.baseAmount === undefined) transactionalOrder.depositAmount = chargedAmount;
        transactionalOrder.depositPaidAt = createdPayment.paidAt;
        transactionalOrder.paymentStatus = "partially_paid";
      } else {
        transactionalOrder.paymentStatus = "paid";
      }
      transactionalOrder.paymentMethod = "wallet";

      shouldDispatch =
        paymentType !== "remaining" &&
        transactionalOrder.status === "created";
      if (shouldDispatch) {
        transactionalOrder.readyForMatching = true;
      }
      if (["created", "accepted"].includes(transactionalOrder.status) && transactionalOrder.orderType === "scheduled") {
        transactionalOrder.bookingStatus = transactionalOrder.providerId ? "confirmed" : "awaiting_provider";
      }

      await markOrderVoucherAsUsed(transactionalOrder, session);
      await transactionalOrder.save({ session });
      paymentOrder = transactionalOrder;
      return createdPayment;
    })) ?? null;
  } catch (error: unknown) {
    if (expected && error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
    rethrowDuplicatePaymentError(error);
  } finally {
    await session.endSession();
  }

  if (!payment) {
    throw new AppError("Không thể hoàn tất thanh toán bằng ví", 500);
  }

  if (shouldDispatch) {
    triggerDispatch(paymentOrder._id.toString());
  }

  await createNotificationRecord({
    userId: paymentOrder.customerId,
    type: "PAYMENT",
    title: "Thanh toán thành công",
    content: chargedAmount === 0 ? "Phí cọc đã được miễn bằng mã đổi điểm." : "Đơn hàng đã được thanh toán bằng ví Handigo.",
    data: { orderId: paymentOrder._id, paymentId: payment._id, amount: chargedAmount },
  });

  return {
    payment,
    method: "WALLET" as const,
    paymentType,
    amount: chargedAmount,
  };
};

const reserveExternalPayment = async (
  user: RequestUser,
  input: CreatePaymentInput,
  method: "cash" | "payos",
  gatewayOrderCode?: string,
  expected?: ConfirmedPaymentExpectation,
  previousCashPaymentId?: string,
) => {
  const session = await mongoose.startSession();
  let result: {
    order: any;
    payment: InstanceType<typeof Payment>;
    paymentType: PaymentType;
    amount: number;
  } | null | undefined;

  try {
    result = await session.withTransaction(async () => {
      const order = await Order.findById(input.orderId).session(session);

      if (!order || order.isDeleted) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }

      if (order.customerId.toString() !== user.id && user.role !== "ADMIN") {
        throw new AppError("Bạn không có quyền thanh toán đơn hàng này", 403);
      }

      const paymentType = getPaymentType(order, input.paymentType);
      assertAppointmentPaymentReady(order, paymentType);

      if (order.inspectionRequired && method === "cash") {
        throw new AppError("Đơn khảo sát phải thanh toán tiền đặt cọc qua PayOS", 400);
      }

      const amount = await getPaymentAmount(order, paymentType);
      assertConfirmedPayment(order, amount, paymentType, expected);
      if (amount <= 0) {
        throw new AppError("Số tiền thanh toán không hợp lệ", 400);
      }

      const duplicatePayment = await Payment.findOne({
        orderId: order._id,
        paymentType,
        status: { $in: ["pending", "paid"] },
        isDeleted: false,
      }).session(session);
      const switchingCash = method === "payos" && previousCashPaymentId === String(duplicatePayment?._id)
        && duplicatePayment?.method === "cash" && duplicatePayment.status === "pending";
      if (previousCashPaymentId && !switchingCash) throw new ActionPreconditionError();
      if (duplicatePayment && !switchingCash) {
        throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
      }

      const transactionCode =
        method === "cash"
          ? buildTransactionCode("CASH")
          : String(gatewayOrderCode);
      const payment = switchingCash ? await Payment.findOneAndUpdate({
        _id: duplicatePayment!._id, method: "cash", status: "pending", isDeleted: false,
      }, { $set: { method: "payos", transactionCode, gatewayOrderCode,
        gatewayResponse: { orderCode: Number(gatewayOrderCode), provider: "payos" },
        "metadata.previousMethod": "cash", "metadata.methodChangedAt": new Date() } },
      { new: true, session, runValidators: true }) : (await Payment.create(
        [
          {
            orderId: order._id,
            customerId: order.customerId,
            amount,
            method,
            paymentType,
            status: "pending",
            transactionCode,
            ...(method === "cash"
              ? {
                  metadata: {
                    note: "Khách hàng chọn thanh toán tiền mặt cho nhà cung cấp",
                  },
                }
              : {
                  gatewayOrderCode,
                  gatewayResponse: {
                    orderCode: Number(gatewayOrderCode),
                    provider: "payos",
                  },
                }),
          },
        ],
        { session },
      ))[0];
      if (!payment) throw new ActionPreconditionError();

      if (method === "cash") {
        order.paymentMethod = "cash";
        order.readyForMatching = order.status === "created";
        if (["created", "accepted"].includes(order.status) && order.orderType === "scheduled") {
          order.bookingStatus = order.providerId ? "confirmed" : "awaiting_provider";
        }
      } else {
        order.paymentMethod = "bank";
        if (paymentType !== "remaining") {
          order.readyForMatching = false;
        }
        if (paymentType === "inspection_deposit") {
          if (order.pricing.baseAmount === undefined) order.depositAmount = amount;
        }
      }

      await order.save({ session });
      return { order, payment, paymentType, amount };
    });
  } catch (error: unknown) {
    if (expected && error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
    rethrowDuplicatePaymentError(error);
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new AppError("Không thể tạo giao dịch thanh toán", 500);
  }

  return result;
};

export const previewOrderPayment = async (user: RequestUser, orderId: string, method: CreatePaymentInput["method"], allowMethodSwitch = false) => {
  const order = await Order.findOne({ _id: orderId, customerId: user.id, isDeleted: false });
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if ((!["created", "accepted"].includes(order.status) && !isFixedPriceWorkPayment(order)) || order.paymentStatus !== "unpaid") {
    throw new AppError("Đơn không còn chờ thanh toán. Hãy kiểm tra trạng thái thanh toán của đơn.", 409);
  }
  const paymentType = getPaymentType(order);
  assertAppointmentPaymentReady(order, paymentType);
  if (order.inspectionRequired && method === "CASH") {
    throw new AppError("Tiền đặt cọc khảo sát chỉ thanh toán bằng chuyển khoản hoặc ví Handigo.", 400);
  }
  const amount = await getPaymentAmount(order, paymentType);
  if (amount < 0) throw new AppError("Số tiền thanh toán không hợp lệ.", 400);
  const existing = await Payment.findOne({ orderId, paymentType, isDeleted: false, status: { $in: ["pending", "paid"] } });
  const switching = allowMethodSwitch && existing?.status === "pending"
    && ((existing.method === "payos" && method !== "PAYOS") || (existing.method === "cash" && method !== "CASH"));
  if (existing && !switching) {
    throw new AppError(existing.status === "paid" ? "Khoản này đã được thanh toán. Hãy kiểm tra trạng thái đơn."
      : existing.method === "payos" ? "Đang có giao dịch PayOS. Hãy kiểm tra thanh toán để tiếp tục liên kết cũ; hủy trên PayOS và kiểm tra lại trước khi đổi phương thức."
      : "Đơn đã có giao dịch đang chờ. Hãy kiểm tra thanh toán, không tạo giao dịch mới.", 409);
  }
  if (method === "WALLET" && amount > 0) {
    const wallet = await Wallet.findOne({ userId: user.id, isDeleted: false }).select("balance");
    if (!wallet || wallet.balance < amount) {
      const missing = amount - (wallet?.balance ?? 0);
      throw new AppError(`Ví còn thiếu ${missing.toLocaleString("vi-VN")} đ. Vui lòng nạp ví hoặc chọn chuyển khoản; đơn hàng vẫn được giữ nguyên.`, 400);
    }
  }
  return { title: switching ? "Xác nhận đổi phương thức thanh toán" : method === "WALLET" ? "Xác nhận trừ tiền ví" : method === "CASH" ? "Xác nhận thanh toán tiền mặt" : "Tạo liên kết chuyển khoản",
    orderId: String(order._id), orderCode: order.orderCode, amount, paymentType,
    ...(switching ? { previousPaymentId: String(existing!._id), previousPaymentMethod: existing!.method as "cash" | "payos" } : {}),
    paymentMethod: method === "PAYOS" ? "bank" : method === "WALLET" ? "wallet" : "cash",
    paymentLabel: paymentType === "inspection_deposit" ? "Tiền đặt cọc khảo sát" : "Thanh toán toàn bộ dịch vụ",
    note: switching && existing?.method === "cash" ? `Xác nhận sẽ thay giao dịch tiền mặt đang chờ bằng ${method === "WALLET" ? "thanh toán từ ví Handigo" : "chuyển khoản PayOS"} trên cùng đơn. Không trả thêm tiền mặt cho khoản này; đơn hàng và voucher được giữ nguyên. ${method === "PAYOS" ? "Tạo mã QR chưa có nghĩa đã thanh toán." : "Số tiền trên sẽ được trừ từ ví."}`
      : switching ? `Xác nhận sẽ hủy liên kết PayOS đang chờ trên cùng đơn rồi ${method === "WALLET" ? "trừ số tiền trên từ ví Handigo" : "ghi nhận thanh toán trực tiếp cho nhà cung cấp"}. Mã QR cũ sẽ không còn dùng được; đơn hàng và voucher được giữ nguyên.`
      : method === "WALLET" ? "Xác nhận sẽ trừ số tiền trên từ ví Handigo."
      : method === "CASH" ? "Thanh toán trực tiếp cho nhà cung cấp; chưa ghi nhận đã thanh toán."
      : "Sau xác nhận, mở liên kết PayOS để thanh toán. Tạo liên kết chưa có nghĩa đã thanh toán." };
};

// Hủy và kiểm tra lại trên PayOS trước khi giải phóng giao dịch đang chờ.
const cancelPendingPayosPayment = async (
  payment: InstanceType<typeof Payment>, user: RequestUser,
  reason: string, signal?: AbortSignal, cancellationActionId?: string,
) => {
  const gatewayOrderCode = Number(payment.gatewayOrderCode);
  if (!Number.isSafeInteger(gatewayOrderCode) || gatewayOrderCode <= 0) {
    throw new ActionPreconditionError("Giao dịch thiếu mã đối soát hợp lệ. Hãy kiểm tra thanh toán trước khi tiếp tục.");
  }
  const checkLink = async () => {
    const link = await payos.paymentRequests.get(gatewayOrderCode).catch(() => {
      throw new ActionPreconditionError("Không thể kiểm tra PayOS. Hãy kiểm tra thanh toán rồi thử lại.");
    });
    if ((payment.gatewayPaymentLinkId && link.id !== payment.gatewayPaymentLinkId)
      || link.orderCode !== gatewayOrderCode || link.amount !== payment.amount) {
      throw new ActionPreconditionError("Thông tin PayOS không khớp giao dịch. Hãy kiểm tra thanh toán.");
    }
    return link;
  };
  let link = await checkLink();
  if (link.status === "PAID") {
    await reconcilePayosPaymentForOrder(payment.orderId.toString(), user);
    return "paid" as const;
  }
  if (!Number.isFinite(link.amountPaid) || link.amountPaid !== 0 || link.status === "PROCESSING") {
    throw new ActionPreconditionError("PayOS đang xử lý hoặc đã nhận tiền. Hãy kiểm tra thanh toán; chưa thể hủy QR hoặc đổi phương thức.");
  }
  if (link.status === "PENDING") {
    signal?.throwIfAborted();
    // Không mở giao dịch mới nếu hủy thất bại hoặc kết quả chưa rõ.
    try {
      await payos.paymentRequests.cancel(gatewayOrderCode, reason);
    } catch {
      // Có thể PayOS đã hủy hoặc vừa nhận tiền dù lời gọi trả lỗi; chỉ tin lần kiểm tra tiếp theo.
    }
    link = await checkLink();
  }
  if (link.status === "PAID") {
    await reconcilePayosPaymentForOrder(payment.orderId.toString(), user);
    return "paid" as const;
  }
  if (!["CANCELLED", "EXPIRED", "FAILED"].includes(link.status) || link.amountPaid !== 0) {
    throw new ActionPreconditionError("Chưa xác minh được liên kết PayOS đã hủy và chưa nhận tiền. Hãy kiểm tra thanh toán trước khi tiếp tục.");
  }
  signal?.throwIfAborted();
  const transition = await Payment.updateOne({ _id: payment._id, status: "pending", isDeleted: false }, {
    $set: { status: "failed", failedAt: new Date(), failureReason: cancellationActionId
      ? "Khách hàng đã hủy giao dịch QR thanh toán" : "Đã hủy PayOS để đổi phương thức thanh toán",
      ...(cancellationActionId ? { "metadata.customerCancelledQr": true, "metadata.agentCancellationActionId": cancellationActionId } : {}),
      "gatewayResponse.statusCheck": { status: link.status, checkedAt: new Date(), amountPaid: link.amountPaid } },
  }, { runValidators: true });
  if (transition.modifiedCount !== 1) throw new ActionPreconditionError();
  publishPaymentStatus({ _id: payment._id, orderId: payment.orderId, customerId: payment.customerId,
    method: payment.method, status: "failed" });
  return "failed" as const;
};

export const previewAgentPaymentCancellation = async (user: RequestUser, orderId: string, paymentId?: string) => {
  if (user.role !== "CUSTOMER") throw new AppError("Hủy QR qua trợ lý chỉ dành cho khách hàng.", 403);
  const order = await Order.findOne({ _id: orderId, customerId: user.id, isDeleted: false });
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if (order.paymentStatus !== "unpaid") throw new AppError("Đơn đã ghi nhận thanh toán. Vui lòng kiểm tra thanh toán, không hủy QR cũ.", 409);
  if (!["created", "accepted"].includes(order.status) && !isFixedPriceWorkPayment(order)) throw new AppError("Đơn không còn ở trạng thái có thể hủy QR qua trợ lý.", 409);
  const payment = await Payment.findOne({ orderId, customerId: user.id, method: "payos", status: "pending", isDeleted: false,
    ...(paymentId ? { _id: paymentId } : {}) });
  if (!payment || !["full", "inspection_deposit"].includes(payment.paymentType)) {
    throw new AppError("Không có giao dịch QR đang chờ phù hợp. Vui lòng kiểm tra thanh toán của đơn.", 409);
  }
  return { title: "Hủy giao dịch QR thanh toán", orderId, orderCode: order.orderCode,
    paymentId: String(payment._id), amount: payment.amount, paymentType: payment.paymentType,
    note: "Xác nhận sẽ hủy mã QR đang chờ. Đơn hàng được giữ theo thời hạn thanh toán hiện tại. Sau khi hủy, bạn có thể chọn thanh toán lại hoặc phương thức khác; chưa hủy đơn và chưa tạo giao dịch mới." };
};

export const cancelAgentPendingPayment = async (user: RequestUser, orderId: string, expected: ConfirmedPaymentCancellation,
  actionId: string, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  if (user.role !== "CUSTOMER") throw new AppError("Hủy QR qua trợ lý chỉ dành cho khách hàng.", 403);
  const order = await Order.findOne({ _id: orderId, customerId: user.id, isDeleted: false });
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  const payment = await Payment.findOne({ _id: expected.paymentId, orderId, customerId: user.id,
    method: "payos", amount: expected.amount, paymentType: expected.paymentType, isDeleted: false });
  if (!payment) throw new ActionPreconditionError("Giao dịch QR đã thay đổi. Vui lòng kiểm tra thanh toán trước khi chọn lại.");
  if (payment.status === "paid") return;
  if (payment.status === "failed" && payment.metadata?.agentCancellationActionId === actionId) return;
  if ((!["created", "accepted"].includes(order.status) && !isFixedPriceWorkPayment(order)) || order.paymentStatus !== "unpaid" || payment.status !== "pending") {
    throw new ActionPreconditionError("Trạng thái đơn hoặc giao dịch đã thay đổi. Vui lòng kiểm tra thanh toán.");
  }
  await cancelPendingPayosPayment(payment, user, "Khách hàng hủy QR thanh toán qua trợ lý", signal, actionId);
};

export const cancelPendingPayosPaymentForOrder = async (orderId: string, user: RequestUser) => {
  const order = await Order.findOne({
    _id: orderId, customerId: user.id, isDeleted: false,
    status: "created", paymentStatus: "unpaid", readyForMatching: false,
  });
  if (!order) {
    const discarded = await Order.findOne({ _id: orderId, customerId: user.id,
      isDeleted: true, status: "created", paymentStatus: "unpaid" });
    if (discarded) return;
    throw new AppError("Đơn hàng không còn ở trạng thái có thể đổi thanh toán.", 409);
  }
  const payment = await Payment.findOne({
    orderId: order._id, customerId: user.id, method: "payos", status: "pending", isDeleted: false,
  });
  if (payment && await cancelPendingPayosPayment(payment, user, "Khách hàng quay lại để thay đổi thanh toán") === "paid") {
    throw new AppError("Đơn hàng đã được thanh toán qua PayOS.", 409);
  }
};

// Chỉ luồng trợ lý có bản xác nhận chuyển giao dịch mới được đổi phương thức.
export const createAgentOrderPayment = async (user: RequestUser, input: CreatePaymentInput, expected: ConfirmedPaymentExpectation, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const preview = await previewOrderPayment(user, input.orderId, input.method, true);
  if (preview.amount !== expected.amount || preview.paymentType !== expected.paymentType
    || preview.previousPaymentId !== expected.previousPaymentId
    || preview.previousPaymentMethod !== expected.previousPaymentMethod) throw new ActionPreconditionError();
  if (!expected.previousPaymentId) {
    signal?.throwIfAborted();
    return createPayment(user, input, expected);
  }

  const payment = await Payment.findOne({ _id: expected.previousPaymentId, orderId: input.orderId,
    customerId: user.id, paymentType: expected.paymentType, amount: expected.amount,
    method: expected.previousPaymentMethod, status: "pending", isDeleted: false });
  if (!payment) throw new ActionPreconditionError();
  if (payment.method === "cash") {
    if (input.method === "CASH") throw new ActionPreconditionError();
    signal?.throwIfAborted();
    // Chuyển trên cùng bản ghi trong transaction để giữ index chống trả trùng và rollback khi ví thiếu.
    const result = await createPayment(user, input, expected, String(payment._id));
    return result;
  }
  if (input.method === "PAYOS") throw new ActionPreconditionError();
  const result = await cancelPendingPayosPayment(payment, user, "Khách hàng đổi phương thức thanh toán qua trợ lý", signal);
  if (result === "paid") return;
  // Các transaction và index duy nhất hiện có tiếp tục chặn thanh toán trùng.
  signal?.throwIfAborted();
  try {
    return await createPayment(user, input, expected);
  } catch (error) {
    if (error instanceof ActionPreconditionError) {
      throw new ActionPreconditionError(`${error.message} Liên kết PayOS cũ đã hủy; hãy kiểm tra thanh toán rồi chọn lại phương thức trên cùng đơn.`);
    }
    throw error;
  }
};

export const createOrderPayment = async (user: RequestUser, input: CreatePaymentInput) => {
  const order = await Order.findById(input.orderId);
  if (!order || order.isDeleted) throw new AppError("Không tìm thấy đơn hàng", 404);
  if (order.customerId.toString() !== user.id) {
    if (user.role === "ADMIN") return createPayment(user, input);
    throw new AppError("Bạn không có quyền thanh toán đơn hàng này", 403);
  }
  if (order.status === "cancelled") throw new AppError("Đơn đã hủy, không thể đổi phương thức thanh toán.", 409);
  const paymentType = getPaymentType(order, input.paymentType);
  const previous = await Payment.findOne({ orderId: order._id, customerId: user.id, paymentType,
    method: { $in: ["payos", "cash"] }, status: { $in: ["pending", "paid"] }, isDeleted: false });
  if (!previous) return createPayment(user, input);
  if (previous.method === "cash" && (!isFixedPriceWorkPayment(order) || input.method === "CASH")) {
    return createPayment(user, input);
  }
  if (previous.method === "payos" && input.method === "PAYOS") return createPayment(user, input);
  if (order.inspectionRequired && input.method === "CASH") {
    throw new AppError("Tiền đặt cọc khảo sát chỉ thanh toán bằng chuyển khoản hoặc ví Handigo.", 400);
  }
  if (input.expectedAmount !== undefined && input.expectedAmount !== previous.amount) throw new ActionPreconditionError();
  if (previous.status === "paid") return { payment: previous, amount: previous.amount, paymentType };
  const preview = await previewOrderPayment(user, input.orderId, input.method, true);
  if (input.expectedAmount !== undefined && input.expectedAmount !== preview.amount) throw new ActionPreconditionError();
  const result = await createAgentOrderPayment(user, input, {
    amount: preview.amount, paymentType: preview.paymentType,
    previousPaymentId: preview.previousPaymentId, previousPaymentMethod: preview.previousPaymentMethod,
  });
  if (result) return result;
  // PayOS vừa nhận tiền trong lúc đổi: trả giao dịch đã xác minh, không thu thêm.
  const paid = await Payment.findOne({ _id: previous._id, orderId: order._id, customerId: user.id,
    paymentType, method: "payos", status: "paid", isDeleted: false });
  if (!paid || paid.amount !== preview.amount) throw new AppError("Chưa xác minh được kết quả thanh toán. Vui lòng kiểm tra lại đơn.", 409);
  return { payment: paid, amount: paid.amount, paymentType };
};

export const createPayment = async (user: RequestUser, input: CreatePaymentInput, expected?: ConfirmedPaymentExpectation, previousCashPaymentId?: string) => {
  const order = await Order.findById(input.orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (order.customerId.toString() !== user.id && user.role !== "ADMIN") {
    throw new AppError("Bạn không có quyền thanh toán đơn hàng này", 403);
  }

  const paymentType = getPaymentType(order, input.paymentType);
  if (!expected && input.expectedAmount !== undefined) {
    expected = { amount: input.expectedAmount, paymentType };
  }
  if (order.inspectionRequired && input.method === "CASH") {
    throw new AppError("Đơn khảo sát phải thanh toán tiền đặt cọc qua PayOS", 400);
  }

  const amount = await getPaymentAmount(order, paymentType);
  if (amount === 0) {
    const result = await mongoose.connection.transaction(async session => {
      const current = await Order.findById(order._id).session(session);
      if (!current || current.isDeleted || (current.customerId.toString() !== user.id && user.role !== "ADMIN")) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
      const currentAmount = await getPaymentAmount(current, paymentType);
      if (currentAmount !== 0) throw new AppError("Giá vừa thay đổi. Vui lòng kiểm tra lại tổng tiền.", 409);
      if (getPaymentType(current, input.paymentType) !== paymentType || (expected &&
        (expected.amount !== currentAmount || expected.paymentType !== paymentType))) throw new ActionPreconditionError();
      const existing = await Payment.findOne({ orderId: current._id, paymentType, isDeleted: false, status: { $in: ["pending", "paid"] } }).session(session);
      if (existing?.status === "paid" && existing.amount === 0 && current.status !== "cancelled") return { payment: existing, shouldDispatch: false };
      if (existing) throw new AppError("Đơn đã có giao dịch đang chờ. Vui lòng kiểm tra thanh toán.", 409);
      assertAppointmentPaymentReady(current, paymentType);
      assertConfirmedPayment(current, currentAmount, paymentType, expected);
      if (!["created", "accepted"].includes(current.status) || current.paymentStatus !== "unpaid") throw new AppError("Đơn không còn chờ thanh toán.", 409);
      const [payment] = await Payment.create([{
        orderId: current._id, customerId: current.customerId, amount: 0,
        method: input.method === "PAYOS" ? "payos" : input.method === "WALLET" ? "wallet" : "cash", paymentType, status: "paid", paidAt: new Date(),
        transactionCode: buildTransactionCode("DISCOUNT"), gatewayResponse: { fullyDiscounted: true },
      }], { session });
      current.paymentMethod = input.method === "PAYOS" ? "bank" : input.method === "WALLET" ? "wallet" : "cash";
      await current.save({ session });
      const shouldDispatch = await syncPaidPayosPaymentToOrder(payment, session, true);
      return { payment, shouldDispatch };
    });
    if (result.shouldDispatch) triggerDispatch(order._id.toString());
    return { payment: result.payment, amount: 0, paymentType };
  }
  assertAppointmentPaymentReady(order, paymentType);
  assertConfirmedPayment(order, amount, paymentType, expected);
  if (amount < 0) {
    throw new AppError("Số tiền thanh toán không hợp lệ", 400);
  }

  const redirectUrls = input.method === "PAYOS" ? buildOrderPaymentRedirects(order._id.toString(),
    resolvePaymentFrontendOrigin(input.cancelUrl, input.returnUrl,
      process.env.FRONTEND_URL, "https://localhost:5173"), {
      returnUrl: process.env.PAYOS_RETURN_URL, cancelUrl: process.env.PAYOS_CANCEL_URL,
      clientCancelUrl: input.cancelUrl,
    }) : undefined;
  const duplicatePayment = await Payment.findOne({
    orderId: order._id,
    paymentType,
    status: { $in: ["pending", "paid"] },
    isDeleted: false,
  });

  const switchingCash = previousCashPaymentId === String(duplicatePayment?._id)
    && duplicatePayment?.method === "cash" && duplicatePayment.status === "pending" && input.method !== "CASH";
  if (previousCashPaymentId && !switchingCash) throw new ActionPreconditionError();

  if (
    duplicatePayment?.method === "payos" &&
    duplicatePayment.status === "pending"
  ) {
    const previousRedirects = duplicatePayment.gatewayResponse?.redirectUrls as { cancelUrl?: string } | undefined;
    if (redirectUrls && previousRedirects?.cancelUrl !== redirectUrls.cancelUrl) {
      // Không mở lại QR có URL hủy cũ; chỉ thay sau khi xác minh chưa nhận tiền.
      const status = await cancelPendingPayosPayment(duplicatePayment, user, "Cập nhật đường dẫn quay lại sau khi hủy QR");
      if (status === "paid") {
        const paid = await Payment.findById(duplicatePayment._id);
        if (!paid || paid.status !== "paid") throw new AppError("Chưa xác minh được kết quả thanh toán. Vui lòng kiểm tra lại đơn.", 409);
        return { payment: paid, amount: paid.amount, paymentType };
      }
    } else {
      const pendingPayosLink = await reconcileExistingPendingPayosPayment(duplicatePayment);
      if (pendingPayosLink) {
        if (input.method !== "PAYOS") {
          throw new AppError(
            "Giao dịch PayOS vẫn đang chờ thanh toán. Hãy hủy giao dịch PayOS trước khi chọn phương thức khác.",
            409,
          );
        }
        if (!pendingPayosLink.checkoutUrl) {
          throw new AppError("Giao dịch PayOS không có liên kết thanh toán hợp lệ", 409);
        }
        return {
          payment: duplicatePayment,
          checkoutUrl: pendingPayosLink.checkoutUrl,
          qrCode: pendingPayosLink.qrCode,
          paymentType,
        };
      }
    }
  } else if (duplicatePayment && !switchingCash) {
    throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
  }

  if (input.method === "WALLET") {
    return createWalletPayment(order, paymentType, amount, expected, previousCashPaymentId);
  }

  if (input.method === "CASH") {
    const reserved = await reserveExternalPayment(user, input, "cash", undefined, expected);
    triggerDispatch(reserved.order._id.toString());

    return {
      payment: reserved.payment,
      method: "CASH",
      paymentType: reserved.paymentType,
      amount: reserved.amount,
    };
  }

  if (!redirectUrls) throw new AppError("Không xác định được đường dẫn quay lại sau thanh toán.", 400);
  const orderCode = buildPayosOrderCode();
  const reserved = await reserveExternalPayment(
    user,
    input,
    "payos",
    orderCode.toString(),
    expected,
    previousCashPaymentId,
  );
  const payment = reserved.payment;
  const reservedAmount = reserved.amount;
  const reservedPaymentType = reserved.paymentType;

  let paymentLink;

  try {
    paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: reservedAmount,
      description: reservedPaymentType === "inspection_deposit" ? "Dat coc FixNow" : "Thanh toan FixNow",
      ...redirectUrls,
      items: [
        {
          name: reservedPaymentType === "inspection_deposit" ? "Đặt cọc dịch vụ FixNow" : "Thanh toán dịch vụ FixNow",
          quantity: 1,
          price: reservedAmount,
        },
      ],
    });

    payment.gatewayPaymentLinkId = paymentLink.paymentLinkId;
    payment.gatewayResponse = {
      ...((payment.gatewayResponse as Record<string, unknown>) || {}),
      paymentLink,
      redirectUrls,
    };
    await payment.save();
  } catch (error: any) {
    payment.status = "failed";
    payment.failedAt = new Date();
    payment.failureReason = error.message || "Không thể tạo liên kết thanh toán PayOS";
    payment.gatewayResponse = {
      ...((payment.gatewayResponse as Record<string, unknown>) || {}),
      error: payment.failureReason,
    };
    await payment.save();
    throw new AppError("Không thể tạo liên kết thanh toán PayOS", 502);
  }

  return {
    payment,
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode,
    paymentType: reservedPaymentType,
  };
};

export const chargeProviderPlatformFeeOnAccept = async (orderId: string, providerUserId: string) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (order.inspectionRequired) {
    throw new AppError("Dịch vụ báo giá không trừ phí nền tảng từ ví thợ", 400);
  }

  const provider = await Provider.findOne({ userId: providerUserId });
  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  if (order.providerId && order.providerId.toString() !== provider._id.toString()) {
    throw new AppError("Thợ không khớp với đơn hàng", 403);
  }

  const existingTransaction = await WalletTransaction.findOne({
    relatedOrderId: order._id,
    userId: provider.userId,
    type: "platform_fee",
    status: "success",
  });

  if (existingTransaction || order.platformFeeChargedAt) {
    return existingTransaction;
  }

  const platformFee = Math.max(order.pricing?.platformCommissionAmount || 0, 0);

  if (platformFee <= 0) {
    throw new AppError("Phí nền tảng không hợp lệ", 400);
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId: provider.userId, balance: { $gte: platformFee } },
    { $inc: { balance: -platformFee } },
    { new: true },
  );

  if (!wallet) {
    throw new AppError("Số dư ví không đủ để nhận đơn", 400);
  }

  const transaction = await WalletTransaction.create({
    walletId: wallet._id,
    userId: provider.userId,
    relatedOrderId: order._id,
    type: "platform_fee",
    direction: "out",
    amount: platformFee,
    balanceAfter: wallet.balance,
    status: "success",
    transactionCode: buildTransactionCode("PLATFORM_FEE"),
    description: "Trừ phí nền tảng khi thợ nhận đơn giá cố định",
    metadata: {
      orderCode: order.orderCode,
    },
  });

  order.platformFeeChargedAt = new Date();
  await order.save();

  await createNotificationRecord({
    userId: provider.userId,
    type: "PAYMENT",
    title: "Đã trừ phí nền tảng",
    content: "Hệ thống đã trừ phí nền tảng từ ví của bạn khi nhận đơn.",
    data: {
      orderId: order._id,
      transactionId: transaction._id,
      amount: platformFee,
    },
  });

  return transaction;
};

const syncPaidPayosPaymentToOrder = async (
  payment: InstanceType<typeof Payment>,
  session: ClientSession,
  markVoucherUsed = true,
) => {
  const order = await Order.findById(payment.orderId).session(session);
  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng của giao dịch PayOS", 404);
  }

  if (order.status === "cancelled") {
    return false;
  }

  if (payment.paymentType === "inspection_deposit") {
    if (order.pricing.baseAmount === undefined) order.depositAmount = payment.amount;
    order.depositPaidAt = payment.paidAt;
    if (order.paymentStatus !== "paid") order.paymentStatus = "partially_paid";
  } else {
    const [summary] = await Payment.aggregate<{ total: number }>([
      {
        $match: {
          orderId: order._id,
          status: "paid",
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).session(session);
    const requiredAmount = Math.max(
      order.pricing?.totalPaidAmount ?? order.pricing?.bookingAmount ?? 0,
      0,
    );
    order.paymentStatus =
      (summary?.total || 0) >= requiredAmount ? "paid" : "partially_paid";
  }

  const shouldDispatch =
    payment.paymentType !== "remaining" &&
    order.status === "created" &&
    (payment.paymentType === "inspection_deposit" || order.paymentStatus === "paid");
  if (shouldDispatch) {
    order.readyForMatching = true;
  }
  if (["created", "accepted"].includes(order.status) && order.orderType === "scheduled") {
    order.bookingStatus = order.providerId ? "confirmed" : "awaiting_provider";
  }
  if (markVoucherUsed) {
    await markOrderVoucherAsUsed(order, session);
  }
  await order.save({ session });
  return shouldDispatch;
};

type PayosPaymentLink = {
  orderCode?: number;
  amount?: number;
  id?: string;
  status?: string;
  amountPaid?: number;
  transactions?: Array<{ reference?: string }>;
};

// Tiền của QR cũ không được áp vào đơn đã loại bỏ hoặc thay thế giao dịch còn hiệu lực.
const refundUnappliedPayosPayment = async (payment: InstanceType<typeof Payment>, session: ClientSession) => {
  const order = await Order.findOneAndUpdate(
    { _id: payment.orderId, customerId: payment.customerId },
    { $inc: { __v: 1 } }, { new: true, session, runValidators: true },
  );
  if (!order) throw new AppError("Không tìm thấy đơn hàng của giao dịch PayOS.", 404);
  const replacement = await Payment.findOne({
    _id: { $ne: payment._id }, orderId: payment.orderId, paymentType: payment.paymentType,
    status: { $in: ["pending", "paid"] }, isDeleted: false,
  }).session(session);
  if (!order.isDeleted && !replacement) return false;

  const now = new Date();
  const reason = order.isDeleted
    ? "Hoàn tiền QR đến muộn sau khi đơn chưa thanh toán đã được loại bỏ."
    : "Hoàn tiền QR cũ vì đơn đã có giao dịch thanh toán thay thế.";
  const wallet = await Wallet.findOneAndUpdate(
    { userId: payment.customerId, isDeleted: false },
    { $inc: { balance: payment.amount }, $setOnInsert: { pendingBalance: 0, currency: "VND" } },
    { new: true, upsert: true, session, runValidators: true },
  );
  if (!wallet) throw new AppError("Không thể hoàn khoản thanh toán đến muộn vào ví.", 409);
  payment.status = "refunded";
  payment.paidAt = now;
  payment.refundedAt = now;
  payment.failedAt = null;
  payment.failureReason = null;
  payment.refundReason = reason;
  payment.isDeleted = false;
  payment.deletedAt = null;
  payment.metadata = { ...payment.metadata, refund: {
    status: "succeeded", channel: "handigo_wallet", destination: "handigo_wallet", sourceMethod: "payos",
    referenceId: "REFUND" + payment._id.toString(), amount: payment.amount, completedAt: now,
    fallbackReason: order.isDeleted ? "discarded_order" : "replaced_payment",
  } };
  await payment.save({ session });
  await WalletTransaction.create([{
    walletId: wallet._id, userId: payment.customerId, relatedOrderId: payment.orderId,
    relatedPaymentId: payment._id, type: "refund", direction: "in", amount: payment.amount,
    balanceAfter: wallet.balance, status: "success", transactionCode: buildTransactionCode("REFUND"),
    description: reason, metadata: { sourceMethod: "payos", orderCode: order.orderCode },
  }], { session });
  await Refund.updateOne({ paymentId: payment._id }, { $setOnInsert: {
    paymentId: payment._id, orderId: payment.orderId, customerId: payment.customerId,
    amount: payment.amount, reason, referenceId: "REFUND" + payment._id.toString(),
    sourceMethod: "payos", currency: "VND", channel: "handigo_wallet", destination: "handigo_wallet",
    status: "succeeded", completedAt: now, nextRetryAt: null,
  } }, { upsert: true, session, runValidators: true });
  return true;
};

const reconcilePayosPayment = async (payment: InstanceType<typeof Payment>) => {
  const orderId = payment.orderId.toString();
  const gatewayOrderCode = Number(payment.gatewayOrderCode);
  if (!Number.isSafeInteger(gatewayOrderCode) || gatewayOrderCode <= 0) {
    throw new AppError("Mã giao dịch PayOS không hợp lệ", 409);
  }

  let paymentLink: PayosPaymentLink;
  try {
    paymentLink = await payos.paymentRequests.get(gatewayOrderCode);
  } catch (error: unknown) {
    paymentLogger.error("Không thể đối soát giao dịch PayOS.", error, {
      orderId,
      paymentId: payment._id.toString(),
    });
    throw new AppError("Không thể đối soát giao dịch PayOS", 502);
  }

  const normalizedStatus = paymentLink.status?.toUpperCase();
  const amountPaid = Number(paymentLink.amountPaid || 0);
  const gatewayPaymentLinkId = paymentLink.id?.toString();
  const gatewayTransactionId = paymentLink.transactions?.[0]?.reference?.toString();

  if ((paymentLink.orderCode !== undefined && paymentLink.orderCode !== gatewayOrderCode)
    || (paymentLink.amount !== undefined && paymentLink.amount !== payment.amount)
    || (normalizedStatus === "PAID" && !gatewayTransactionId)
    || (payment.gatewayTransactionId && gatewayTransactionId && payment.gatewayTransactionId !== gatewayTransactionId)) {
    throw new AppError("Thông tin đối soát PayOS không khớp giao dịch", 409);
  }

  if (normalizedStatus === "PAID" && (!Number.isFinite(amountPaid) || amountPaid < payment.amount)) {
    throw new AppError("Số tiền PayOS đã thanh toán không khớp giao dịch", 409);
  }
  if (
    payment.gatewayPaymentLinkId &&
    payment.gatewayPaymentLinkId !== gatewayPaymentLinkId
  ) {
    throw new AppError("Mã liên kết PayOS không khớp giao dịch", 409);
  }

  const session = await mongoose.startSession();
  let shouldDispatch = false;
  let notification: Awaited<ReturnType<typeof createNotificationRecord>> | null = null;

  try {
    await withTransactionRetry(session, async () => {
      shouldDispatch = false;
      notification = null;
      const currentPayment = await Payment.findById(payment._id).session(session);
      if (!currentPayment) {
        throw new AppError("Không tìm thấy giao dịch PayOS", 404);
      }

      if (currentPayment.status === "paid") {
        shouldDispatch = await syncPaidPayosPaymentToOrder(currentPayment, session);
        return;
      }
      if (!["pending", "failed"].includes(currentPayment.status)) return;
      if (currentPayment.status === "failed" && normalizedStatus !== "PAID") return;

      currentPayment.gatewayResponse = {
        ...((currentPayment.gatewayResponse as Record<string, unknown>) || {}),
        reconciledAt: new Date(),
        reconciliation: paymentLink,
      };

      if (normalizedStatus === "PAID") {
        currentPayment.status = "paid";
        currentPayment.paidAt = new Date();
        currentPayment.failedAt = null;
        currentPayment.failureReason = null;
        currentPayment.gatewayPaymentLinkId =
          gatewayPaymentLinkId || currentPayment.gatewayPaymentLinkId || null;
        currentPayment.gatewayTransactionId =
          gatewayTransactionId || currentPayment.gatewayTransactionId || null;
        if (await refundUnappliedPayosPayment(currentPayment, session)) {
          notification = await createNotificationRecord({
            userId: currentPayment.customerId, type: "PAYMENT", title: "Đã hoàn tiền QR đến muộn",
            content: "Khoản thanh toán QR cũ đã được đối soát và hoàn vào ví Handigo.",
            data: { orderId: currentPayment.orderId, paymentId: currentPayment._id, amount: currentPayment.amount, refundChannel: "handigo_wallet" },
          }, { session, deferRealtime: true });
          return;
        }
        currentPayment.isDeleted = false;
        currentPayment.deletedAt = null;
      } else if (["CANCELLED", "EXPIRED", "FAILED"].includes(normalizedStatus || "")) {
        if (!Number.isFinite(amountPaid) || amountPaid !== 0) throw new AppError("PayOS đã nhận tiền hoặc số tiền chưa rõ. Cần đối soát trước khi thanh toán lại.", 409);
        currentPayment.status = "failed";
        currentPayment.failedAt = new Date();
        currentPayment.failureReason = `PayOS trả về trạng thái ${normalizedStatus}`;
      }

      await currentPayment.save({ session });
      if (currentPayment.status === "paid") {
        shouldDispatch = await syncPaidPayosPaymentToOrder(currentPayment, session);
        notification = await createNotificationRecord({
          userId: currentPayment.customerId, type: "PAYMENT", title: "Thanh toán thành công",
          content: "Giao dịch PayOS của bạn đã được đối soát thành công.",
          data: { orderId: currentPayment.orderId, paymentId: currentPayment._id, amount: currentPayment.amount },
        }, { session, deferRealtime: true });
      }
    });
  } finally {
    await session.endSession();
  }

  const reconciledPayment = await Payment.findById(payment._id);
  const reconciledOrder = await Order.findById(orderId);

  if (reconciledPayment) publishPaymentStatus(reconciledPayment);

  if (notification) {
    try { emitRealtimeNotification(notification); }
    catch { paymentLogger.warn("Đã đối soát thanh toán; chưa phát được thông báo tức thời."); }
  }
  if (shouldDispatch && reconciledPayment) {
    triggerDispatch(reconciledPayment.orderId.toString());
  }
  if (
    reconciledPayment?.status === "paid" &&
    reconciledOrder?.status === "cancelled"
  ) {
    triggerCancelledOrderSettlement(reconciledOrder._id.toString());
  }

  return { payment: reconciledPayment, order: reconciledOrder };
};

const reconcilePendingPayosPayment = async (orderId: string) => {
  const failedPayments = await Payment.find({ orderId, method: "payos", status: "failed",
    gatewayOrderCode: { $ne: null } }).sort({ createdAt: 1 });
  for (const payment of failedPayments) await reconcilePayosPayment(payment);

  const payment = await Payment.findOne({ orderId, method: "payos", status: "pending", isDeleted: false })
    .sort({ createdAt: -1 });
  if (payment) return reconcilePayosPayment(payment);

  const paidPayment = await Payment.findOne({ orderId, method: "payos", status: "paid", isDeleted: false })
    .sort({ createdAt: -1 });
  if (paidPayment) {
    const session = await mongoose.startSession();
    try {
      await withTransactionRetry(session, async () => {
        const current = await Payment.findById(paidPayment._id).session(session);
        if (current?.status === "paid" && !current.isDeleted) await syncPaidPayosPaymentToOrder(current, session);
      });
    } finally { await session.endSession(); }
  }
  return { payment: paidPayment ? await Payment.findById(paidPayment._id) : null, order: await Order.findById(orderId) };
};

export const reconcilePayosPaymentForOrder = async (
  orderId: string,
  user: RequestUser,
) => {
  const order = await Order.findById(orderId);
  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }
  if (!(await canAccessOrder(order, user))) {
    throw new AppError("Bạn không có quyền đối soát thanh toán của đơn hàng này", 403);
  }

  return reconcilePendingPayosPayment(orderId);
};

export const reconcilePayosPaymentForExpiration = async (orderId: string) =>
  reconcilePendingPayosPayment(orderId);

export const handlePayosWebhook = async (payload: any) => {
  const webhookData = await payos.webhooks.verify(payload);
  const orderCode = webhookData.orderCode?.toString();
  if (!orderCode) {
    throw new AppError("Webhook PayOS thiếu mã đơn giao dịch", 400);
  }

  const paymentCandidate = await Payment.findOne({
    gatewayOrderCode: orderCode,
    method: "payos",
  }).select("_id");
  if (!paymentCandidate) {
    return handleWalletDepositPayosWebhook(webhookData, payload);
  }

  const verifiedAmount = Number(webhookData.amount);
  if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
    throw new AppError("Số tiền trong webhook PayOS không hợp lệ", 400);
  }

  const webhookPaymentLinkId = webhookData.paymentLinkId?.toString();
  const webhookReference = webhookData.reference?.toString();
  const isSuccess = webhookData.code === "00";
  if (isSuccess && !webhookReference) {
    throw new AppError("Webhook PayOS thành công thiếu mã tham chiếu giao dịch", 400);
  }

  const session = await mongoose.startSession();
  let processedPayment: InstanceType<typeof Payment> | null = null;
  let shouldDispatch = false;
  let notification: Awaited<ReturnType<typeof createNotificationRecord>> | null = null;

  try {
    await withTransactionRetry(session, async () => {
      processedPayment = null;
      shouldDispatch = false;
      notification = null;
      const payment = await Payment.findOne({
        _id: paymentCandidate._id,
        gatewayOrderCode: orderCode,
        method: "payos",
      }).session(session);
      if (!payment) {
        throw new AppError("Không tìm thấy giao dịch PayOS", 404);
      }

      if (payment.amount !== verifiedAmount) {
        throw new AppError("Số tiền webhook PayOS không khớp giao dịch", 409);
      }
      if (
        payment.gatewayPaymentLinkId &&
        payment.gatewayPaymentLinkId !== webhookPaymentLinkId
      ) {
        throw new AppError("Mã liên kết PayOS không khớp giao dịch", 409);
      }
      if (
        payment.gatewayTransactionId &&
        webhookReference &&
        payment.gatewayTransactionId !== webhookReference
      ) {
        throw new AppError("Mã tham chiếu PayOS không khớp giao dịch", 409);
      }

      if (payment.status === "refunded") {
        processedPayment = payment;
        return;
      }
      if (payment.status === "paid") {
        shouldDispatch =
          (await syncPaidPayosPaymentToOrder(payment, session)) ||
          shouldDispatch;
        processedPayment = payment;
        return;
      }
      if (!isSuccess && payment.status === "failed") {
        processedPayment = payment;
        return;
      }

      payment.status = isSuccess ? "paid" : "failed";
      payment.gatewayTransactionId =
        webhookReference || payment.gatewayTransactionId || null;
      payment.gatewayPaymentLinkId =
        webhookPaymentLinkId || payment.gatewayPaymentLinkId || null;
      payment.gatewayResponse = {
        ...((payment.gatewayResponse as Record<string, unknown>) || {}),
        webhook: payload,
        verifiedData: webhookData,
      };

      if (isSuccess && await refundUnappliedPayosPayment(payment, session)) {
        notification = await createNotificationRecord({
          userId: payment.customerId, type: "PAYMENT", title: "Đã hoàn tiền QR đến muộn",
          content: "Khoản thanh toán QR cũ đã được hoàn vào ví Handigo. Đơn và giao dịch thay thế được giữ nguyên.",
          data: { orderId: payment.orderId, paymentId: payment._id, amount: payment.amount, refundChannel: "handigo_wallet" },
        }, { session, deferRealtime: true });
        processedPayment = payment;
        return;
      }

      if (isSuccess) {
        payment.isDeleted = false;
        payment.deletedAt = null;
        payment.paidAt = new Date();
        payment.failedAt = null;
        payment.failureReason = null;
      } else {
        payment.failedAt = new Date();
        payment.failureReason =
          webhookData.desc || payload.desc || "Thanh toán PayOS thất bại";
      }

      await payment.save({ session });
      if (isSuccess) {
        shouldDispatch =
          (await syncPaidPayosPaymentToOrder(payment, session, true)) ||
          shouldDispatch;
      }

      notification = await createNotificationRecord(
        {
          userId: payment.customerId,
          type: "PAYMENT",
          title: isSuccess ? "Thanh toán thành công" : "Thanh toán thất bại",
          content: isSuccess
            ? "Giao dịch PayOS của bạn đã được xác nhận."
            : "Giao dịch PayOS của bạn không thành công.",
          data: {
            orderId: payment.orderId,
            paymentId: payment._id,
            amount: payment.amount,
          },
        },
        { session, deferRealtime: true },
      );
      processedPayment = payment;
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("Mã giao dịch PayOS đã được sử dụng", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const resultPayment = processedPayment as InstanceType<typeof Payment> | null;
  if (!resultPayment) {
    throw new AppError("Không thể xử lý webhook PayOS", 500);
  }
  publishPaymentStatus(resultPayment);
  if (notification) {
    try { emitRealtimeNotification(notification); }
    catch { paymentLogger.warn("Đã ghi nhận thanh toán; chưa phát được thông báo tức thời."); }
  }
  if (shouldDispatch) {
    triggerDispatch(resultPayment.orderId.toString());
  }
  const resultOrder = await Order.findById(resultPayment.orderId).select("status");
  if (resultPayment.status === "paid" && resultOrder?.status === "cancelled") {
    triggerCancelledOrderSettlement(resultPayment.orderId.toString());
  }

  return resultPayment;
};

export const getPaymentById = async (paymentId: string, user: RequestUser) => {
  const payment = await Payment.findById(paymentId);

  if (!payment || payment.isDeleted) {
    throw new AppError("Không tìm thấy giao dịch", 404);
  }

  const order = await Order.findById(payment.orderId);
  if (!order || !(await canAccessOrder(order, user))) {
    throw new AppError("Bạn không có quyền xem giao dịch này", 403);
  }

  return payment;
};

export const getPaymentsByOrder = async (orderId: string, user: RequestUser) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (!(await canAccessOrder(order, user))) {
    throw new AppError("Bạn không có quyền xem giao dịch của đơn hàng này", 403);
  }

  const payments = await Payment.find({ orderId }).sort({ createdAt: -1 });
  const platformFeeTransaction = await WalletTransaction.findOne({
    relatedOrderId: orderId,
    type: "platform_fee",
    status: "success",
  }).sort({ createdAt: -1 });

  return {
    payments,
    platformFeeTransaction,
  };
};

export const getPaymentHistory = async (user: RequestUser, query: PaymentHistoryQuery) => {
  const filter: Record<string, unknown> = {};
  if (query.fromDate || query.toDate) {
    filter[query.dateField ?? "createdAt"] = {
      ...(query.fromDate ? { $gte: query.fromDate } : {}),
      ...(query.toDate ? { $lte: query.toDate } : {}),
    };
    filter.isDeleted = false;
  }

  if (query.status) {
    filter.status = query.status;
  } else if (query.dateField === "paidAt") {
    filter.status = { $in: ["paid", "refunded"] };
  } else if (query.dateField === "refundedAt") {
    filter.status = "refunded";
  }

  if (query.method) {
    filter.method = query.method;
  }

  if (query.paymentType) {
    filter.paymentType = query.paymentType;
  }

  if (user.role === "PROVIDER") {
    const provider = await Provider.findOne({ userId: user.id }).select("_id");

    if (!provider) {
      return {
        items: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const orders = await Order.find({ providerId: provider._id }).select("_id");
    filter.orderId = { $in: orders.map((order) => order._id) };
  } else if (user.role !== "ADMIN") {
    filter.customerId = user.id;
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total, orderTotals] = await Promise.all([
    Payment.find(filter).sort(query.dateField ? { [query.dateField]: -1, _id: -1 } : { createdAt: -1 }).skip(skip).limit(query.limit),
    Payment.countDocuments(filter),
    user.role === "ADMIN" ? Payment.aggregate<{ total: number }>([
      { $match: filter }, { $group: { _id: "$orderId" } }, { $count: "total" },
    ]) : Promise.resolve([]),
  ]);

  const orders = user.role === "ADMIN" && items.length
    ? await Order.find({ _id: { $in: items.map(payment => payment.orderId) }, isDeleted: false }).select("_id orderCode").lean()
    : [];
  const orderCodes = new Map(orders.map(order => [String(order._id), order.orderCode]));

  return {
    ...(user.role === "ADMIN" ? { totalOrders: orderTotals[0]?.total ?? 0 } : {}),
    items: user.role === "ADMIN" ? items.map(payment => ({ ...payment.toObject(), orderCode: orderCodes.get(String(payment.orderId)) ?? null })) : items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const refundInspectionDepositIfNoProvider = async (orderId: string) => {
  const order = await Order.findById(orderId);

  if (!order || !order.inspectionRequired || order.providerId) {
    return null;
  }

  const payment = await Payment.findOne({
    orderId,
    method: "payos",
    status: { $in: ["pending", "paid"] },
    paymentType: "inspection_deposit",
    compensatedToProviderId: null,
  });

  if (!payment) {
    return null;
  }

  const { cancelSystemOrderWithSettlement } = await import(
    "./orderCancellation.service"
  );
  await cancelSystemOrderWithSettlement(
    orderId,
    "Không có nhà cung cấp nhận đơn khảo sát",
  );

  return Payment.findById(payment._id);
};

export const compensateProviderFromInspectionDeposit = async (
  orderId: string,
  providerUserId: string,
  reason = "Khách hàng không thực hiện đơn khảo sát",
) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (!order.inspectionRequired) {
    throw new AppError("Chỉ đơn khảo sát mới có thể chuyển cọc bồi thường", 400);
  }

  const provider = await Provider.findOne({ userId: providerUserId });
  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
    throw new AppError("Thợ không khớp với đơn hàng", 403);
  }

  const payment = await Payment.findOne({
    orderId,
    method: "payos",
    paymentType: "inspection_deposit",
    status: "paid",
  });

  if (!payment) {
    throw new AppError("Đơn hàng chưa có tiền cọc hợp lệ", 400);
  }

  if (payment.compensatedToProviderId) {
    throw new AppError("Tiền cọc đã được chuyển bồi thường cho thợ", 409);
  }

  const existingTransaction = await WalletTransaction.findOne({
    relatedOrderId: order._id,
    relatedPaymentId: payment._id,
    type: "provider_earning",
    status: "success",
  });

  if (existingTransaction) {
    return existingTransaction;
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId: provider.userId },
    {
      $setOnInsert: { userId: provider.userId, pendingBalance: 0, currency: "VND" },
      $inc: { balance: payment.amount },
    },
    { new: true, upsert: true },
  );

  const transaction = await WalletTransaction.create({
    walletId: wallet._id,
    userId: provider.userId,
    relatedOrderId: order._id,
    relatedPaymentId: payment._id,
    type: "provider_earning",
    direction: "in",
    amount: payment.amount,
    balanceAfter: wallet.balance,
    status: "success",
    transactionCode: buildTransactionCode("COMPENSATION"),
    description: "Bồi thường tiền cọc do khách không thực hiện đơn khảo sát",
    metadata: {
      reason,
      orderCode: order.orderCode,
    },
  });

  payment.compensatedToProviderId = provider._id;
  payment.compensatedAt = new Date();
  payment.metadata = {
    ...((payment.metadata as Record<string, unknown>) || {}),
    compensationReason: reason,
    compensationTransactionId: transaction._id,
  };
  await payment.save();

  await createNotificationRecord({
    userId: provider.userId,
    type: "PAYMENT",
    title: "Nhận bồi thường tiền cọc",
    content: "Tiền cọc của đơn khảo sát đã được chuyển vào ví của bạn.",
    data: {
      orderId: order._id,
      paymentId: payment._id,
      transactionId: transaction._id,
      amount: payment.amount,
    },
  });

  return transaction;
};


