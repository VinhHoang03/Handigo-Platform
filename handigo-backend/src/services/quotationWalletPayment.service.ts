import mongoose, { Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import type { CreatePaymentInput } from "../validations/payment.validator";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Payment } from "../models/payment.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import { buildTransactionCode, withTransactionRetry } from "../utils/transaction";
import { createLogger } from "../utils/logger";
import { emitToUser } from "../sockets/socketServer";
import { lockProviderSchedule } from "./providerSchedule.service";
import { earnOrderRewards } from "./reward.service";
import { createNotificationRecord } from "./notification.service";

const logger = createLogger("QuotationWalletPayment");

export const validateQuotationPayment = async (user: RequestUser, input: CreatePaymentInput, session: mongoose.ClientSession) => {
  if (user.role !== "CUSTOMER" || !["WALLET", "PAYOS"].includes(input.method)) {
    throw new AppError("Chỉ khách hàng sở hữu đơn được thanh toán báo giá bằng ví hoặc PayOS.", 403);
  }
  if (!input.quotationId || !Number.isInteger(input.expectedRevision) || !Number.isSafeInteger(input.expectedAmount)) {
    throw new AppError("Vui lòng kiểm tra phiên bản báo giá và số tiền trước khi thanh toán.", 400);
  }
  const initialOrder = await Order.findOne({ _id: input.orderId, customerId: user.id, isDeleted: false }).session(session);
  if (!initialOrder) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if (!initialOrder.providerId) throw new AppError("Đơn hàng chưa có thợ thực hiện.", 409);
  await lockProviderSchedule(initialOrder.providerId, session);
  const order = await Order.findOne({ _id: input.orderId, customerId: user.id, isDeleted: false }).session(session);
  if (!order || !order.inspectionRequired || order.status !== "completed" || !order.depositPaidAt) {
    throw new AppError("Chỉ thanh toán báo giá sau khi đơn hoàn thành và tiền cọc đã được thanh toán.", 409);
  }
  const provider = await Provider.findOne({ _id: order.providerId, verified: true, isDeleted: false }).session(session);
  if (!provider || provider.userId.toString() === user.id) throw new AppError("Thợ nhận thanh toán không hợp lệ.", 409);
  if (order.currentQuotationId?.toString() !== input.quotationId) throw new AppError("Báo giá không còn là bản hiện tại. Vui lòng tải lại đơn hàng.", 409);
  const quotation = await RepairQuotation.findOne({ _id: order.currentQuotationId, orderId: order._id,
    customerId: order.customerId, providerId: provider._id, isDeleted: false }).session(session);
  if (!quotation || (quotation.status !== "saved" && !(quotation.status === "approved" && quotation.customerConfirmed))) {
    throw new AppError("Báo giá chưa đủ điều kiện thanh toán.", 409);
  }
  if ((quotation.revision ?? 0) !== input.expectedRevision) throw new AppError("Báo giá đã thay đổi. Vui lòng kiểm tra lại trước khi thanh toán.", 409);
  const appliedDepositAmount = order.pricing.baseAmount !== undefined ? order.pricing.totalPaidAmount : order.depositAmount;
  const amount = Math.max(quotation.finalAmount - Math.max(appliedDepositAmount, 0), 0);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount !== input.expectedAmount) {
    throw new AppError("Số tiền báo giá đã thay đổi hoặc không hợp lệ. Vui lòng tải lại và kiểm tra.", 409);
  }
  if (quotation.directPaymentConfirmedAt || !["partially_paid", "paid"].includes(order.paymentStatus)) {
    throw new AppError("Đơn đã được thanh toán hoặc không còn chờ thanh toán báo giá.", 409);
  }
  return { order, provider, quotation, amount, appliedDepositAmount };
};

export const payQuotationByWallet = async (user: RequestUser, input: CreatePaymentInput) => {
  if (user.role !== "CUSTOMER") throw new AppError("Chỉ khách hàng sở hữu đơn được thanh toán báo giá bằng ví.", 403);
  if (input.method !== "WALLET") throw new AppError("Chi phí báo giá chỉ hỗ trợ thanh toán bằng Ví Handigo hoặc trả trực tiếp cho thợ.", 400);
  if (!input.quotationId || !Number.isInteger(input.expectedRevision) || !Number.isSafeInteger(input.expectedAmount)) {
    throw new AppError("Vui lòng kiểm tra phiên bản báo giá và số tiền trước khi thanh toán.", 400);
  }
  const session = await mongoose.startSession();
  let result;
  try {
    result = await withTransactionRetry(session, async () => {
      const { order, provider, quotation, amount, appliedDepositAmount } = await validateQuotationPayment(user, input, session);
      const existing = await Payment.findOne({ orderId: order._id, paymentType: "remaining",
        status: { $in: ["pending", "paid"] }, isDeleted: false }).session(session);
      if (existing?.status === "paid" && existing.method === "wallet" && existing.amount === amount
        && existing.metadata?.quotationId === input.quotationId && existing.metadata?.quotationRevision === input.expectedRevision
        && order.paymentStatus === "paid" && !quotation.directPaymentConfirmedAt) {
        return { payment: existing, amount, providerUserId: provider.userId, created: false };
      }
      if (existing || quotation.directPaymentConfirmedAt || order.paymentStatus !== "partially_paid") {
        throw new AppError("Đơn đã được thanh toán hoặc không còn chờ thanh toán báo giá.", 409);
      }
      // Cùng ghi vào đơn để chặn xác nhận trực tiếp hoặc thanh toán đồng thời.
      const claimed = await Order.updateOne({ _id: order._id, customerId: order.customerId, providerId: provider._id,
        status: "completed", currentQuotationId: quotation._id, paymentStatus: "partially_paid", isDeleted: false },
      { $set: { paymentStatus: "paid", paymentMethod: "wallet" }, $inc: { __v: 1 } }, { session, runValidators: true });
      if (claimed.matchedCount !== 1) throw new AppError("Trạng thái đơn vừa thay đổi. Vui lòng tải lại.", 409);
      const customerWallet = await Wallet.findOneAndUpdate({ userId: order.customerId, isDeleted: false, balance: { $gte: amount } },
        { $inc: { balance: -amount } }, { returnDocument: "after", session, runValidators: true });
      if (!customerWallet) throw new AppError("Số dư Ví Handigo không đủ để thanh toán báo giá.", 400);
      const providerWallet = await Wallet.findOneAndUpdate({ userId: provider.userId, isDeleted: false },
        { $inc: { balance: amount }, $setOnInsert: { pendingBalance: 0, currency: "VND" } },
        { returnDocument: "after", session, upsert: true, runValidators: true, setDefaultsOnInsert: true });
      if (!providerWallet) throw new AppError("Chưa thể ghi nhận tiền vào ví thợ.", 409);
      const metadata = { quotationId: quotation.id, quotationRevision: quotation.revision ?? 0,
        quotationFinalAmount: quotation.finalAmount, appliedDepositAmount, platformCommissionAmount: 0 };
      const [payment] = await Payment.create([{ orderId: order._id, customerId: order.customerId, amount,
        method: "wallet", paymentType: "remaining", status: "paid", paidAt: new Date(),
        transactionCode: buildTransactionCode("QUOTATION_PAYMENT"), metadata }], { session });
      await WalletTransaction.create([
        { walletId: customerWallet._id, userId: order.customerId, relatedOrderId: order._id, relatedPaymentId: payment!._id,
          type: "payment", direction: "out", amount, balanceAfter: customerWallet.balance, status: "success",
          transactionCode: payment!.transactionCode, description: "Thanh toán phần còn lại của báo giá bằng Ví Handigo", metadata },
        { walletId: providerWallet._id, userId: provider.userId, relatedOrderId: order._id, relatedPaymentId: payment!._id,
          type: "provider_earning", direction: "in", amount, balanceAfter: providerWallet.balance, status: "success",
          transactionCode: buildTransactionCode("QUOTATION_EARNING"), description: "Nhận tiền báo giá qua Ví Handigo, không trừ phí nền tảng", metadata },
      ], { session, ordered: true });
      order.paymentStatus = "paid"; order.paymentMethod = "wallet";
      await earnOrderRewards(order, session);
      return { payment: payment!, amount, providerUserId: provider.userId, created: true };
    });
  } finally { await session.endSession(); }
  if (!result) throw new AppError("Chưa hoàn tất thanh toán báo giá.", 500);
  for (const userId of [user.id, result.providerUserId.toString()]) {
    try { emitToUser(userId, "order:updated", { orderId: input.orderId }); }
    catch { logger.warn("Đã thanh toán báo giá nhưng chưa phát được cập nhật tức thời.", { orderId: input.orderId }); }
  }
  if (result.created) {
    const notifications = await Promise.allSettled([
      createNotificationRecord({ userId: new Types.ObjectId(user.id), type: "PAYMENT", title: "Thanh toán báo giá thành công",
        content: "Đã thanh toán báo giá bằng Ví Handigo. Bạn không cần trả thêm khoản này trực tiếp cho thợ.",
        data: { orderId: input.orderId, paymentId: result.payment._id, amount: result.amount } }, { emitRealtime: true }),
      createNotificationRecord({ userId: result.providerUserId, type: "PAYMENT", title: "Đã nhận tiền báo giá",
        content: "Khách đã thanh toán bằng Ví Handigo. Tiền đã được cộng vào ví của bạn, không trừ phí nền tảng.",
        data: { orderId: input.orderId, paymentId: result.payment._id, amount: result.amount } }, { emitRealtime: true }),
    ]);
    if (notifications.some((item) => item.status === "rejected")) logger.warn("Đã thanh toán báo giá nhưng chưa gửi đủ thông báo.", { orderId: input.orderId });
  }
  return { payment: result.payment, method: "WALLET" as const, paymentType: "remaining" as const, amount: result.amount };
};

/** Chỉ gọi sau khi PayOS đã xác minh giao dịch, trong cùng transaction. */
export const settleQuotationPayosPayment = async (payment: InstanceType<typeof Payment>, session: mongoose.ClientSession) => {
  const context = await validateQuotationPayment({ id: payment.customerId.toString(), role: "CUSTOMER" }, {
    orderId: payment.orderId.toString(), method: "PAYOS", paymentType: "REMAINING", expectedAmount: payment.amount,
    quotationId: payment.metadata?.quotationId as string, expectedRevision: payment.metadata?.quotationRevision as number,
  }, session);
  const { order, provider } = context;
  if (!await WalletTransaction.exists({ relatedPaymentId: payment._id, type: "provider_earning", status: "success" }).session(session)) {
    const wallet = await Wallet.findOneAndUpdate({ userId: provider.userId, isDeleted: false },
      { $inc: { balance: payment.amount }, $setOnInsert: { pendingBalance: 0, currency: "VND" } },
      { new: true, upsert: true, session, runValidators: true });
    if (!wallet) throw new AppError("Chưa thể ghi nhận tiền vào ví thợ.", 409);
    await WalletTransaction.create([{
      walletId: wallet._id, userId: provider.userId, relatedOrderId: order._id, relatedPaymentId: payment._id,
      type: "provider_earning", direction: "in", amount: payment.amount, balanceAfter: wallet.balance, status: "success",
      transactionCode: buildTransactionCode("QUOTATION_EARNING"),
      description: "Nhận tiền báo giá qua PayOS, không trừ phí nền tảng", metadata: payment.metadata,
    }], { session });
  }
  order.paymentStatus = "paid"; order.paymentMethod = "bank";
  await order.save({ session });
  await earnOrderRewards(order, session);
};
