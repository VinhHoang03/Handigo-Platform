import { Types } from "mongoose";
import { payos } from "../configs/payos.config";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";
import { Order } from "../models/order.model";
import { Payment, PaymentType } from "../models/payment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { createNotificationRecord } from "./notification.service";
import type { CreatePaymentInput, PaymentHistoryQuery } from "../validations/payment.validator";
import { handleWalletDepositPayosWebhook } from "./wallet.service";
import { buildTransactionCode } from "../utils/transaction";
import { DispatchService } from "./dispatch.service";
import { createLogger } from "../utils/logger";

const DEFAULT_RETURN_URL = process.env.PAYOS_RETURN_URL || "http://localhost:5173/payment/success";
const DEFAULT_CANCEL_URL = process.env.PAYOS_CANCEL_URL || "http://localhost:5173/payment/cancel";
const paymentLogger = createLogger("PaymentService");

const triggerDispatch = (orderId: string) => {
  DispatchService.dispatchReadyOrder(orderId).catch((error: unknown) =>
    paymentLogger.error("Không thể khởi động điều phối sau thanh toán.", error, {
      orderId,
    }),
  );
};

const buildPayosOrderCode = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12));

const getPaymentType = (
  order: any,
  requestedType?: "INSPECTION_DEPOSIT" | "FULL" | "REMAINING",
): PaymentType => {
  if (order.inspectionRequired) {
    return "inspection_deposit";
  }

  if (requestedType === "REMAINING") {
    return "remaining";
  }

  return "full";
};

const getPaymentAmount = async (order: any, paymentType: PaymentType) => {
  if (paymentType === "full" || paymentType === "remaining") {
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

export const createPayment = async (user: RequestUser, input: CreatePaymentInput) => {
  const order = await Order.findById(input.orderId);

  if (!order || order.isDeleted) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (order.customerId.toString() !== user.id && user.role !== "ADMIN") {
    throw new AppError("Bạn không có quyền thanh toán đơn hàng này", 403);
  }

  const paymentType = getPaymentType(order, input.paymentType);

  if (order.inspectionRequired && input.method === "CASH") {
    throw new AppError("Đơn khảo sát phải thanh toán tiền đặt cọc qua PayOS", 400);
  }

  const amount = await getPaymentAmount(order, paymentType);

  if (amount <= 0) {
    throw new AppError("Số tiền thanh toán không hợp lệ", 400);
  }

  const paymentMethod = input.method === "PAYOS" ? "payos" : "cash";

  const duplicatePayment = await Payment.findOne({
    orderId: order._id,
    method: paymentMethod,
    paymentType,
    status: { $in: ["pending", "paid"] },
  });

  if (duplicatePayment) {
    throw new AppError("Đơn hàng đã có giao dịch thanh toán cùng loại", 409);
  }

  if (input.method === "CASH") {
    const payment = await Payment.create({
      orderId: order._id,
      customerId: order.customerId,
      amount,
      method: "cash",
      paymentType,
      status: "pending",
      transactionCode: buildTransactionCode("CASH"),
      metadata: {
        note: "Khách hàng chọn thanh toán tiền mặt cho nhà cung cấp",
      },
    });

    order.readyForMatching = true;
    await order.save();
    triggerDispatch(order._id.toString());

    return {
      payment,
      method: "CASH",
      paymentType,
      amount,
    };
  }

  order.readyForMatching = false;
  if (paymentType === "inspection_deposit") {
    order.depositAmount = amount;
  }

  const orderCode = buildPayosOrderCode();
  const payment = await Payment.create({
    orderId: order._id,
    customerId: order.customerId,
    amount,
    method: "payos",
    paymentType,
    status: "pending",
    transactionCode: orderCode.toString(),
    gatewayOrderCode: orderCode.toString(),
    gatewayResponse: {
      orderCode,
      provider: "payos",
    },
  });

  let paymentLink;

  try {
    paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount,
      description: paymentType === "inspection_deposit" ? "Dat coc FixNow" : "Thanh toan FixNow",
      returnUrl: input.returnUrl || DEFAULT_RETURN_URL,
      cancelUrl: input.cancelUrl || DEFAULT_CANCEL_URL,
      items: [
        {
          name: paymentType === "inspection_deposit" ? "Đặt cọc dịch vụ FixNow" : "Thanh toán dịch vụ FixNow",
          quantity: 1,
          price: amount,
        },
      ],
    });

    payment.gatewayPaymentLinkId = paymentLink.paymentLinkId;
    payment.gatewayResponse = {
      ...((payment.gatewayResponse as Record<string, unknown>) || {}),
      paymentLink,
    };
    await order.save();
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
    paymentType,
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

export const handlePayosWebhook = async (payload: any) => {
  const webhookData = await payos.webhooks.verify(payload);
  const orderCode = webhookData.orderCode.toString();

  const payment = await Payment.findOne({ gatewayOrderCode: orderCode, method: "payos" });

  if (!payment) {
    return handleWalletDepositPayosWebhook(webhookData, payload);
  }

  if (payment.status === "paid") {
    return payment;
  }

  const isSuccess = payload.success === true && webhookData.code === "00";

  payment.status = isSuccess ? "paid" : "failed";
  payment.gatewayTransactionId = webhookData.reference;
  payment.gatewayPaymentLinkId = webhookData.paymentLinkId;
  payment.gatewayResponse = {
    ...((payment.gatewayResponse as Record<string, unknown>) || {}),
    webhook: payload,
    verifiedData: webhookData,
  };

  if (isSuccess) {
    payment.paidAt = new Date();
  } else {
    payment.failedAt = new Date();
    payment.failureReason = webhookData.desc || payload.desc || "Thanh toán PayOS thất bại";
  }

  await payment.save();

  if (isSuccess) {
    const order = await Order.findById(payment.orderId);
    if (order) {
      if (payment.paymentType === "inspection_deposit") {
        order.depositAmount = payment.amount;
        order.depositPaidAt = payment.paidAt;
        order.paymentStatus = "partially_paid";
      } else if (payment.paymentType === "full") {
        order.paymentStatus = "paid";
      } else {
        order.paymentStatus = "paid";
      }
      if (payment.paymentType !== "remaining" && order.status === "created") {
        order.readyForMatching = true;
      }
      await order.save();
      triggerDispatch(order._id.toString());
    }
  }

  await createNotificationRecord({
    userId: payment.customerId,
    type: "PAYMENT",
    title: isSuccess ? "Thanh toán thành công" : "Thanh toán thất bại",
    content: isSuccess
      ? "Giao dịch PayOS của bạn đã được xác nhận."
      : "Giao dịch PayOS của bạn không thành công.",
    data: { orderId: payment.orderId, paymentId: payment._id, amount: payment.amount },
  });

  return payment;
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
    status: "paid",
    paymentType: "inspection_deposit",
    compensatedToProviderId: null,
  });

  if (!payment) {
    return null;
  }

  payment.status = "refunded";
  payment.refundedAt = new Date();
  payment.refundReason = "Không có thợ nhận đơn khảo sát";
  payment.gatewayResponse = {
    ...((payment.gatewayResponse as Record<string, unknown>) || {}),
    refundReason: payment.refundReason,
  };
  await payment.save();

  order.readyForMatching = false;
  await order.save();

  await createNotificationRecord({
    userId: payment.customerId,
    type: "PAYMENT",
    title: "Hoàn tiền đặt cọc",
    content: "Tiền đặt cọc đã được đánh dấu hoàn do chưa có thợ nhận đơn.",
    data: {
      orderId: payment.orderId,
      paymentId: payment._id,
      amount: payment.amount,
    },
  });

  return payment;
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
