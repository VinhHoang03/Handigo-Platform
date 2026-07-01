import mongoose, { Types } from "mongoose";
import { payos } from "../configs/payos.config";
import { AppError } from "../utils/appError";
import { Notification } from "../models/notification.model";
import { Order } from "../models/order.model";
import { Payment, PaymentType } from "../models/payment.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import type { CreatePaymentInput, PaymentHistoryQuery } from "../validations/payment.validation";
import { handleWalletDepositPayosWebhook } from "./wallet.service";
import { dispatchOrderForMatching } from "./order.service";

type RequestUser = {
  id: string;
  role: string;
};

const DEFAULT_RETURN_URL = process.env.PAYOS_RETURN_URL || "http://localhost:5173/payment/success";
const DEFAULT_CANCEL_URL = process.env.PAYOS_CANCEL_URL || "http://localhost:5173/payment/cancel";

const buildPayosOrderCode = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12));
const buildTransactionCode = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

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
    throw new AppError("Dá»‹ch vá»¥ kháº£o sÃ¡t chÆ°a cáº¥u hÃ¬nh tiá»n Ä‘áº·t cá»c", 400);
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

const createNotification = async (
  userId: Types.ObjectId | string,
  title: string,
  content: string,
  data?: Record<string, unknown>,
) => {
  await Notification.create({
    userId,
    type: "PAYMENT",
    title,
    content,
    data: data || null,
  });
};


const createWalletPayment = async (order: any, paymentType: PaymentType, amount: number) => {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOneAndUpdate(
        {
          userId: order.customerId,
          isDeleted: false,
          balance: { $gte: amount },
        },
        { $inc: { balance: -amount } },
        { new: true, session },
      );

      if (!wallet) {
        throw new AppError("Sá»‘ dÆ° vÃ­ khÃ´ng Ä‘á»§ Ä‘á»ƒ thanh toÃ¡n Ä‘Æ¡n hÃ ng", 400);
      }

      const [payment] = await Payment.create(
        [
          {
            orderId: order._id,
            customerId: order.customerId,
            amount,
            method: "wallet",
            paymentType,
            status: "paid",
            paidAt: new Date(),
            transactionCode: buildTransactionCode("WALLET_PAYMENT"),
            metadata: {
              walletId: wallet._id,
              orderCode: order.orderCode,
            },
          },
        ],
        { session },
      );

      const [walletTransaction] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            relatedOrderId: order._id,
            relatedPaymentId: payment._id,
            type: "payment",
            direction: "out",
            amount,
            balanceAfter: wallet.balance,
            status: "success",
            transactionCode: buildTransactionCode("WALLET_PAYMENT"),
            description: "Thanh toÃ¡n Ä‘Æ¡n hÃ ng báº±ng vÃ­ Handigo",
            metadata: {
              paymentId: payment._id,
              orderCode: order.orderCode,
              paymentType,
            },
          },
        ],
        { session },
      );

      if (paymentType === "inspection_deposit") {
        order.depositAmount = amount;
        order.depositPaidAt = payment.paidAt;
        order.paymentStatus = "partially_paid";
      } else {
        order.paymentStatus = "paid";
      }

      order.readyForMatching = true;
      await order.save({ session });

      result = {
        payment,
        walletTransaction,
        method: "WALLET",
        paymentType,
        amount,
      };
    });
  } finally {
    await session.endSession();
  }

  if (result) {
    await dispatchOrderForMatching(order._id.toString());
  }

  return result;
};
export const createPayment = async (user: RequestUser, input: CreatePaymentInput) => {
  const order = await Order.findById(input.orderId);

  if (!order || order.isDeleted) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng", 404);
  }

  if (order.customerId.toString() !== user.id && user.role !== "ADMIN") {
    throw new AppError("Báº¡n khÃ´ng cÃ³ quyá»n thanh toÃ¡n Ä‘Æ¡n hÃ ng nÃ y", 403);
  }

  const paymentType = getPaymentType(order, input.paymentType);

  if (order.inspectionRequired && input.method === "CASH") {
    throw new AppError("ÄÆ¡n kháº£o sÃ¡t pháº£i thanh toÃ¡n tiá»n Ä‘áº·t cá»c qua PayOS", 400);
  }

  const amount = await getPaymentAmount(order, paymentType);

  if (amount <= 0) {
    throw new AppError("Sá»‘ tiá»n thanh toÃ¡n khÃ´ng há»£p lá»‡", 400);
  }

  const paymentMethod = input.method === "PAYOS" ? "payos" : input.method === "WALLET" ? "wallet" : "cash";

  const duplicatePayment = await Payment.findOne({
    orderId: order._id,
    method: paymentMethod,
    paymentType,
    status: { $in: ["pending", "paid"] },
  });

  if (duplicatePayment) {
    throw new AppError("ÄÆ¡n hÃ ng Ä‘Ã£ cÃ³ giao dá»‹ch thanh toÃ¡n cÃ¹ng loáº¡i", 409);
  }

  if (input.method === "WALLET") {
    return createWalletPayment(order, paymentType, amount);
  }

  if (input.method === "CASH") {
    order.readyForMatching = true;
    await order.save();
    await dispatchOrderForMatching(order._id.toString());

    const payment = await Payment.create({
      orderId: order._id,
      customerId: order.customerId,
      amount,
      method: "cash",
      paymentType,
      status: "pending",
      transactionCode: buildTransactionCode("CASH"),
      metadata: {
        note: "KhÃ¡ch hÃ ng chá»n thanh toÃ¡n tiá»n máº·t cho nhÃ  cung cáº¥p",
      },
    });

    return {
      payment,
      method: "CASH",
      paymentType,
      amount,
    };
  }

  if (paymentType !== "inspection_deposit") {
    order.readyForMatching = false;
  } else {
    order.depositAmount = amount;
    order.readyForMatching = false;
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
          name: paymentType === "inspection_deposit" ? "Äáº·t cá»c dá»‹ch vá»¥ FixNow" : "Thanh toÃ¡n dá»‹ch vá»¥ FixNow",
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
    payment.failureReason = error.message || "KhÃ´ng thá»ƒ táº¡o liÃªn káº¿t thanh toÃ¡n PayOS";
    payment.gatewayResponse = {
      ...((payment.gatewayResponse as Record<string, unknown>) || {}),
      error: payment.failureReason,
    };
    await payment.save();
    throw new AppError("KhÃ´ng thá»ƒ táº¡o liÃªn káº¿t thanh toÃ¡n PayOS", 502);
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
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng", 404);
  }

  if (order.inspectionRequired) {
    throw new AppError("Dá»‹ch vá»¥ bÃ¡o giÃ¡ khÃ´ng trá»« phÃ­ ná»n táº£ng tá»« vÃ­ thá»£", 400);
  }

  const provider = await Provider.findOne({ userId: providerUserId });
  if (!provider) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ thá»£", 404);
  }

  if (order.providerId && order.providerId.toString() !== provider._id.toString()) {
    throw new AppError("Thá»£ khÃ´ng khá»›p vá»›i Ä‘Æ¡n hÃ ng", 403);
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
    throw new AppError("PhÃ­ ná»n táº£ng khÃ´ng há»£p lá»‡", 400);
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId: provider.userId, balance: { $gte: platformFee } },
    { $inc: { balance: -platformFee } },
    { new: true },
  );

  if (!wallet) {
    throw new AppError("Sá»‘ dÆ° vÃ­ khÃ´ng Ä‘á»§ Ä‘á»ƒ nháº­n Ä‘Æ¡n", 400);
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
    description: "Trá»« phÃ­ ná»n táº£ng khi thá»£ nháº­n Ä‘Æ¡n giÃ¡ cá»‘ Ä‘á»‹nh",
    metadata: {
      orderCode: order.orderCode,
    },
  });

  order.platformFeeChargedAt = new Date();
  await order.save();

  await createNotification(provider.userId, "ÄÃ£ trá»« phÃ­ ná»n táº£ng", "Há»‡ thá»‘ng Ä‘Ã£ trá»« phÃ­ ná»n táº£ng tá»« vÃ­ cá»§a báº¡n khi nháº­n Ä‘Æ¡n.", {
    orderId: order._id,
    transactionId: transaction._id,
    amount: platformFee,
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
    payment.failureReason = webhookData.desc || payload.desc || "Thanh toÃ¡n PayOS tháº¥t báº¡i";
  }

  await payment.save();

  if (isSuccess) {
    const order = await Order.findById(payment.orderId);
    if (order) {
      if (payment.paymentType === "inspection_deposit") {
        order.depositAmount = payment.amount;
        order.depositPaidAt = payment.paidAt;
        order.paymentStatus = "partially_paid";
      } else {
        order.paymentStatus = "paid";
      }
      order.readyForMatching = true;
      await order.save();
      await dispatchOrderForMatching(order._id.toString());
    }
  }

  await createNotification(
    payment.customerId,
    isSuccess ? "Thanh toÃ¡n thÃ nh cÃ´ng" : "Thanh toÃ¡n tháº¥t báº¡i",
    isSuccess ? "Giao dá»‹ch PayOS cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n." : "Giao dá»‹ch PayOS cá»§a báº¡n khÃ´ng thÃ nh cÃ´ng.",
    { orderId: payment.orderId, paymentId: payment._id, amount: payment.amount },
  );

  return payment;
};

export const getPaymentById = async (paymentId: string, user: RequestUser) => {
  const payment = await Payment.findById(paymentId);

  if (!payment || payment.isDeleted) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch", 404);
  }

  const order = await Order.findById(payment.orderId);
  if (!order || !(await canAccessOrder(order, user))) {
    throw new AppError("Báº¡n khÃ´ng cÃ³ quyá»n xem giao dá»‹ch nÃ y", 403);
  }

  return payment;
};

export const getPaymentsByOrder = async (orderId: string, user: RequestUser) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng", 404);
  }

  if (!(await canAccessOrder(order, user))) {
    throw new AppError("Báº¡n khÃ´ng cÃ³ quyá»n xem giao dá»‹ch cá»§a Ä‘Æ¡n hÃ ng nÃ y", 403);
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
  payment.refundReason = "KhÃ´ng cÃ³ thá»£ nháº­n Ä‘Æ¡n kháº£o sÃ¡t";
  payment.gatewayResponse = {
    ...((payment.gatewayResponse as Record<string, unknown>) || {}),
    refundReason: payment.refundReason,
  };
  await payment.save();

  order.readyForMatching = false;
  await order.save();

  await createNotification(payment.customerId, "HoÃ n tiá»n Ä‘áº·t cá»c", "Tiá»n Ä‘áº·t cá»c Ä‘Ã£ Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u hoÃ n do chÆ°a cÃ³ thá»£ nháº­n Ä‘Æ¡n.", {
    orderId: payment.orderId,
    paymentId: payment._id,
    amount: payment.amount,
  });

  return payment;
};

export const compensateProviderFromInspectionDeposit = async (
  orderId: string,
  providerUserId: string,
  reason = "KhÃ¡ch hÃ ng khÃ´ng thá»±c hiá»‡n Ä‘Æ¡n kháº£o sÃ¡t",
) => {
  const order = await Order.findById(orderId);

  if (!order || order.isDeleted) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng", 404);
  }

  if (!order.inspectionRequired) {
    throw new AppError("Chá»‰ Ä‘Æ¡n kháº£o sÃ¡t má»›i cÃ³ thá»ƒ chuyá»ƒn cá»c bá»“i thÆ°á»ng", 400);
  }

  const provider = await Provider.findOne({ userId: providerUserId });
  if (!provider) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ thá»£", 404);
  }

  if (!order.providerId || order.providerId.toString() !== provider._id.toString()) {
    throw new AppError("Thá»£ khÃ´ng khá»›p vá»›i Ä‘Æ¡n hÃ ng", 403);
  }

  const payment = await Payment.findOne({
    orderId,
    method: "payos",
    paymentType: "inspection_deposit",
    status: "paid",
  });

  if (!payment) {
    throw new AppError("ÄÆ¡n hÃ ng chÆ°a cÃ³ tiá»n cá»c há»£p lá»‡", 400);
  }

  if (payment.compensatedToProviderId) {
    throw new AppError("Tiá»n cá»c Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn bá»“i thÆ°á»ng cho thá»£", 409);
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
    description: "Bá»“i thÆ°á»ng tiá»n cá»c do khÃ¡ch khÃ´ng thá»±c hiá»‡n Ä‘Æ¡n kháº£o sÃ¡t",
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

  await createNotification(provider.userId, "Nháº­n bá»“i thÆ°á»ng tiá»n cá»c", "Tiá»n cá»c cá»§a Ä‘Æ¡n kháº£o sÃ¡t Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn vÃ o vÃ­ cá»§a báº¡n.", {
    orderId: order._id,
    paymentId: payment._id,
    transactionId: transaction._id,
    amount: payment.amount,
  });

  return transaction;
};


