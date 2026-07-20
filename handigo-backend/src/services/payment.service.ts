import mongoose, { Types } from "mongoose";
import { payos } from "../configs/payos.config";
import type { ClientSession } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";
import { Order } from "../models/order.model";
import { Payment, PaymentType } from "../models/payment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { createNotificationRecord } from "./notification.service";
import type { CreatePaymentInput, PaymentHistoryQuery } from "../validations/payment.validator";
import { handleWalletDepositPayosWebhook } from "./wallet.service";
import { buildTransactionCode } from "../utils/transaction";
import { DispatchService } from "./dispatch.service";
import { createLogger } from "../utils/logger";
import { markOrderVoucherAsUsed } from "./voucher.service";

const DEFAULT_RETURN_URL = process.env.PAYOS_RETURN_URL || "http://localhost:5173/payment/success";
const DEFAULT_CANCEL_URL = process.env.PAYOS_CANCEL_URL || "http://localhost:5173/payment/cancel";
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

const reconcilePendingPayosPayment = async (
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
  DispatchService.dispatchReadyOrder(orderId).catch((error: unknown) =>
    paymentLogger.error("Không thể khởi động điều phối sau thanh toán.", error, {
      orderId,
    }),
  );
};

const assertAppointmentPaymentReady = (
  order: InstanceType<typeof Order>,
  paymentType?: PaymentType,
) => {
  if (paymentType === "remaining") return;
  if (!["scheduled", "recurring"].includes(order.orderType)) return;
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
    return "remaining";
  }

  if (order.inspectionRequired) {
    return "inspection_deposit";
  }

  return "full";
};

const getPaymentAmount = async (
  order: any,
  paymentType: PaymentType,
  session?: ClientSession,
) => {
  if (paymentType === "remaining") {
    const aggregate = Payment.aggregate<{ total: number }>([
      {
        $match: {
          orderId: order._id,
          status: "paid",
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    if (session) aggregate.session(session);
    const [summary] = await aggregate;
    const requiredAmount = Math.max(
      order.pricing?.totalPaidAmount || order.pricing?.bookingAmount || 0,
      0,
    );
    return Math.max(requiredAmount - (summary?.total || 0), 0);
  }

  if (paymentType === "full") {
    return Math.max(order.pricing?.totalPaidAmount || order.pricing?.bookingAmount || 0, 0);
  }

  const depositAmount = order.depositAmount || 0;

  if (depositAmount <= 0) {
    throw new AppError("Dịch vụ khảo sát chưa cấu hình tiền đặt cọc", 400);
  }

  return depositAmount;
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

const createWalletPayment = async (order: any, paymentType: PaymentType, amount: number) => {
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

      chargedAmount = await getPaymentAmount(transactionalOrder, paymentType, session);
      if (chargedAmount <= 0) {
        throw new AppError("Số tiền thanh toán không hợp lệ", 400);
      }

      const duplicatePayment = await Payment.findOne({
        orderId: transactionalOrder._id,
        paymentType,
        status: { $in: ["pending", "paid"] },
        isDeleted: false,
      }).session(session);
      if (duplicatePayment) {
        throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
      }

      const wallet = await Wallet.findOneAndUpdate(
        {
          userId: transactionalOrder.customerId,
          isDeleted: false,
          balance: { $gte: chargedAmount },
        },
        { $inc: { balance: -chargedAmount } },
        { new: true, session },
      );

      if (!wallet) {
        throw new AppError("Số dư ví không đủ để thanh toán", 400);
      }

      const transactionCode = buildTransactionCode("PAYMENT");
      const [createdPayment] = await Payment.create(
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
          },
        ],
        { session },
      );

      await WalletTransaction.create(
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
        transactionalOrder.depositAmount = chargedAmount;
        transactionalOrder.depositPaidAt = createdPayment.paidAt;
        transactionalOrder.paymentStatus = "partially_paid";
      } else {
        transactionalOrder.paymentStatus = "paid";
      }
      transactionalOrder.paymentMethod = "wallet";

      shouldDispatch = paymentType !== "remaining" && transactionalOrder.status === "created";
      if (shouldDispatch) {
        transactionalOrder.readyForMatching = true;
      }
      if (["scheduled", "recurring"].includes(transactionalOrder.orderType)) {
        transactionalOrder.bookingStatus = "confirmed";
        transactionalOrder.readyForMatching = false;
      }

      await markOrderVoucherAsUsed(transactionalOrder, session);
      await transactionalOrder.save({ session });
      paymentOrder = transactionalOrder;
      return createdPayment;
    })) ?? null;
  } catch (error: unknown) {
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
    content: "Đơn hàng đã được thanh toán bằng ví Handigo.",
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

      if (paymentType === "remaining") {
        if (!order.inspectionRequired || !order.currentQuotationId) {
          throw new AppError("Đơn hàng không có báo giá cần thanh toán phần còn lại", 400);
        }

        const approvedQuotation = await RepairQuotation.exists({
          _id: order.currentQuotationId,
          orderId: order._id,
          status: "approved",
        }).session(session);
        if (!approvedQuotation || order.status !== "in_progress") {
          throw new AppError("Chỉ có thể thanh toán phần còn lại sau khi duyệt báo giá", 400);
        }
      }

      if (order.inspectionRequired && method === "cash") {
        throw new AppError("Đơn khảo sát phải thanh toán tiền đặt cọc qua PayOS", 400);
      }

      const amount = await getPaymentAmount(order, paymentType, session);
      if (amount <= 0) {
        throw new AppError("Số tiền thanh toán không hợp lệ", 400);
      }

      const duplicatePayment = await Payment.findOne({
        orderId: order._id,
        paymentType,
        status: { $in: ["pending", "paid"] },
        isDeleted: false,
      }).session(session);
      if (duplicatePayment) {
        throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
      }

      const transactionCode =
        method === "cash"
          ? buildTransactionCode("CASH")
          : String(gatewayOrderCode);
      const [payment] = await Payment.create(
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
      );

      if (method === "cash") {
        order.paymentMethod = "cash";
        order.readyForMatching = !["scheduled", "recurring"].includes(order.orderType);
        if (["scheduled", "recurring"].includes(order.orderType)) {
          order.bookingStatus = "confirmed";
        }
      } else {
        order.paymentMethod = "bank";
        if (paymentType !== "remaining") {
          order.readyForMatching = false;
        }
        if (paymentType === "inspection_deposit") {
          order.depositAmount = amount;
        }
      }

      await order.save({ session });
      return { order, payment, paymentType, amount };
    });
  } catch (error: unknown) {
    rethrowDuplicatePaymentError(error);
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new AppError("Không thể tạo giao dịch thanh toán", 500);
  }

  return result;
};

export const createPayment = async (user: RequestUser, input: CreatePaymentInput) => {
  const order = await Order.findById(input.orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (order.customerId.toString() !== user.id && user.role !== "ADMIN") {
    throw new AppError("Bạn không có quyền thanh toán đơn hàng này", 403);
  }

  const paymentType = getPaymentType(order, input.paymentType);
  assertAppointmentPaymentReady(order, paymentType);

  if (paymentType === "remaining") {
    if (!order.inspectionRequired || !order.currentQuotationId) {
      throw new AppError("Đơn hàng không có báo giá cần thanh toán phần còn lại", 400);
    }

    const approvedQuotation = await RepairQuotation.exists({
      _id: order.currentQuotationId,
      orderId: order._id,
      status: "approved",
    });
    if (!approvedQuotation || order.status !== "in_progress") {
      throw new AppError("Chỉ có thể thanh toán phần còn lại sau khi duyệt báo giá", 400);
    }
  }

  if (order.inspectionRequired && input.method === "CASH") {
    throw new AppError("Đơn khảo sát phải thanh toán tiền đặt cọc qua PayOS", 400);
  }

  const amount = await getPaymentAmount(order, paymentType);

  if (amount <= 0) {
    throw new AppError("Số tiền thanh toán không hợp lệ", 400);
  }

  const duplicatePayment = await Payment.findOne({
    orderId: order._id,
    paymentType,
    status: { $in: ["pending", "paid"] },
    isDeleted: false,
  });

  if (
    duplicatePayment?.method === "payos" &&
    duplicatePayment.status === "pending"
  ) {
    const pendingPayosLink = await reconcilePendingPayosPayment(duplicatePayment);
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
  } else if (duplicatePayment) {
    throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
  }

  if (input.method === "WALLET") {
    return createWalletPayment(order, paymentType, amount);
  }

  if (input.method === "CASH") {
    const reserved = await reserveExternalPayment(user, input, "cash");
    triggerDispatch(reserved.order._id.toString());

    return {
      payment: reserved.payment,
      method: "CASH",
      paymentType: reserved.paymentType,
      amount: reserved.amount,
    };
  }

  const orderCode = buildPayosOrderCode();
  const reserved = await reserveExternalPayment(
    user,
    input,
    "payos",
    orderCode.toString(),
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
      returnUrl: input.returnUrl || DEFAULT_RETURN_URL,
      cancelUrl: input.cancelUrl || DEFAULT_CANCEL_URL,
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
  markVoucherUsed = false,
) => {
  const order = await Order.findById(payment.orderId).session(session);
  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng của giao dịch PayOS", 404);
  }

  if (payment.paymentType === "inspection_deposit") {
    order.depositAmount = payment.amount;
    order.depositPaidAt = payment.paidAt;
    order.paymentStatus = "partially_paid";
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
      order.pricing?.totalPaidAmount || order.pricing?.bookingAmount || 0,
      0,
    );
    order.paymentStatus =
      (summary?.total || 0) >= requiredAmount ? "paid" : "partially_paid";
  }

  const shouldDispatch =
    payment.paymentType !== "remaining" && order.status === "created";
  if (shouldDispatch) {
    order.readyForMatching = true;
  }
  if (["scheduled", "recurring"].includes(order.orderType)) {
    order.bookingStatus = "confirmed";
    order.readyForMatching = false;
  }
  if (markVoucherUsed) {
    await markOrderVoucherAsUsed(order, session);
  }
  await order.save({ session });
  return shouldDispatch;
};

export const handlePayosWebhook = async (payload: any) => {
  const webhookData = await payos.webhooks.verify(payload);
  const orderCode = webhookData.orderCode?.toString();
  if (!orderCode) {
    throw new AppError("Webhook PayOS thiếu mã đơn giao dịch", 400);
  }

  const paymentCandidate = await Payment.findOne({
    gatewayOrderCode: orderCode,
    method: "payos",
    isDeleted: false,
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

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: paymentCandidate._id,
        gatewayOrderCode: orderCode,
        method: "payos",
        isDeleted: false,
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

      if (isSuccess) {
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

      await createNotificationRecord(
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
        { session },
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
  if (shouldDispatch) {
    triggerDispatch(resultPayment.orderId.toString());
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

  if (query.status) {
    filter.status = query.status;
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
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    Payment.countDocuments(filter),
  ]);

  return {
    items,
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


