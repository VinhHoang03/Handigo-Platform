import mongoose, { ClientSession, Types } from "mongoose";
import { payos } from "../configs/payos.config";
import type { RequestUser } from "../middlewares/authContext";
import { Provider } from "../models/provider.model";
import type { IProvider } from "../models/provider.model";
import type { IOrder } from "../models/order.model";
import User from "../models/user.model";
import { toObjectId } from "../utils/mongo";
import { buildTransactionCode } from "../utils/transaction";
import { Wallet } from "../models/wallet.model";
import {
  WalletTransaction,
  WalletTransactionType,
} from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import type {
  AdminWalletAdjustmentInput,
  AdminWalletListQuery,
  WalletDepositInput,
  WalletTransactionQuery,
} from "../validations/wallet.validator";

type WalletErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "WALLET_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "UNAUTHORIZED_ACCESS"
  | "WALLET_LOCKED";

class WalletError extends AppError {
  code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string, statusCode = 400) {
    super(message, statusCode);
    this.code = code;
  }
}

const buildPayosOrderCode = () =>
  Number(`${Date.now()}${Math.floor(Math.random() * 100)}`.slice(-11)) * 10 + 2;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const DEFAULT_WALLET_DEPOSIT_RETURN_URL =
  process.env.PAYOS_WALLET_DEPOSIT_RETURN_URL || "http://localhost:5173/wallet/deposit/success";
const DEFAULT_WALLET_DEPOSIT_CANCEL_URL =
  process.env.PAYOS_WALLET_DEPOSIT_CANCEL_URL || "http://localhost:5173/wallet/deposit/cancel";

const appendQueryParams = (url: string, params: Record<string, string>) => {
  try {
    const parsedUrl = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      parsedUrl.searchParams.set(key, value);
    });
    return parsedUrl.toString();
  } catch {
    return url;
  }
};

const assertPositiveAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WalletError("INVALID_AMOUNT", "Số tiền không hợp lệ", 400);
  }
};

const getProviderByUserId = async (userId: string | Types.ObjectId) => {
  const provider = await Provider.findOne({ userId, isDeleted: false });

  if (!provider) {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Không tìm thấy hồ sơ nhà cung cấp", 403);
  }

  return provider;
};

const getProviderById = async (providerId: string | Types.ObjectId) => {
  const provider = await Provider.findOne({ _id: providerId, isDeleted: false });

  if (!provider) {
    throw new WalletError("WALLET_NOT_FOUND", "Không tìm thấy nhà cung cấp", 404);
  }

  return provider;
};

const assertWalletOwnerActive = async (
  userId: string | Types.ObjectId,
  session?: ClientSession,
) => {
  const user = await User.findById(userId).select("status").session(session || null);

  if (!user || user.isDeleted) {
    throw new WalletError("WALLET_NOT_FOUND", "Không tìm thấy chủ ví", 404);
  }

  if (user.status === "locked") {
    throw new WalletError("WALLET_LOCKED", "Ví đang bị khóa", 423);
  }
};

const assertWalletAccess = async (user: RequestUser) => {
  if (!["CUSTOMER", "PROVIDER"].includes(user.role)) {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Bạn không có quyền truy cập ví này", 403);
  }

  if (user.role === "PROVIDER") {
    await getProviderByUserId(user.id);
  }

  await assertWalletOwnerActive(user.id);
};

const getWalletByUserId = async (
  userId: string | Types.ObjectId,
  options?: { createIfMissing?: boolean; session?: ClientSession },
) => {
  const filter = { userId, isDeleted: false };
  let wallet = await Wallet.findOne(filter).session(options?.session || null);

  if (!wallet && options?.createIfMissing) {
    wallet = await Wallet.create(
      [
        {
          userId,
          balance: 0,
          pendingBalance: 0,
          currency: "VND",
        },
      ],
      { session: options.session },
    ).then((items) => items[0]);
  }

  if (!wallet) {
    throw new WalletError("WALLET_NOT_FOUND", "Không tìm thấy ví", 404);
  }

  return wallet;
};

const getWalletByProviderId = async (
  providerId: string | Types.ObjectId,
  options?: { createIfMissing?: boolean; session?: ClientSession },
) => {
  const provider = await getProviderById(providerId);
  await assertWalletOwnerActive(provider.userId);

  const wallet = await getWalletByUserId(provider.userId, options);

  return { provider, wallet };
};

const sumTransactions = async (
  userId: string | Types.ObjectId,
  type: WalletTransactionType,
  direction?: "in" | "out",
) => {
  const match: Record<string, unknown> = {
    userId: toObjectId(userId),
    type,
    status: "success",
    isDeleted: false,
  };

  if (direction) {
    match.direction = direction;
  }

  const [result] = await WalletTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return result?.total || 0;
};

const getWalletTotals = async (userId: string | Types.ObjectId) => {
  const [grossEarnings, totalWithdrawn, totalPlatformFeesPaid, totalDeposited, totalPaid] = await Promise.all([
    sumTransactions(userId, "provider_earning", "in"),
    sumTransactions(userId, "withdraw", "out"),
    sumTransactions(userId, "platform_fee", "out"),
    sumTransactions(userId, "deposit", "in"),
    sumTransactions(userId, "payment", "out"),
  ]);

  return {
    totalEarnings: grossEarnings - totalPlatformFeesPaid,
    totalWithdrawn,
    totalPlatformFeesPaid,
    totalDeposited,
    totalPaid,
  };
};

const createWalletTransaction = async (
  input: {
    walletId: Types.ObjectId;
    userId: Types.ObjectId;
    relatedOrderId?: Types.ObjectId | null;
    type: WalletTransactionType;
    direction: "in" | "out";
    amount: number;
    balanceAfter: number;
    description?: string;
    metadata?: Record<string, unknown>;
    transactionCodePrefix: string;
  },
  session?: ClientSession,
) => {
  const [transaction] = await WalletTransaction.create(
    [
      {
        walletId: input.walletId,
        userId: input.userId,
        relatedOrderId: input.relatedOrderId || null,
        type: input.type,
        direction: input.direction,
        amount: input.amount,
        balanceAfter: input.balanceAfter,
        status: "success",
        transactionCode: buildTransactionCode(input.transactionCodePrefix),
        description: input.description || null,
        metadata: input.metadata || null,
      },
    ],
    { session },
  );

  return transaction;
};

const buildTransactionFilter = (
  userId: string | Types.ObjectId,
  query: WalletTransactionQuery,
) => {
  const filter: Record<string, unknown> = {
    userId,
    isDeleted: false,
  };

  if (query.type) {
    filter.type = query.type;
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};

    if (query.fromDate) {
      (filter.createdAt as Record<string, Date>).$gte = query.fromDate;
    }

    if (query.toDate) {
      (filter.createdAt as Record<string, Date>).$lte = query.toDate;
    }
  }

  return filter;
};

export const getCurrentWallet = async (user: RequestUser) => {
  await assertWalletAccess(user);

  const wallet = await getWalletByUserId(user.id, { createIfMissing: true });
  const totals = await getWalletTotals(user.id);

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance,
    totalEarnings: totals.totalEarnings,
    totalWithdrawn: totals.totalWithdrawn,
    totalDeposited: totals.totalDeposited,
    totalPaid: totals.totalPaid,
  };
};

export const getWalletSummary = async (user: RequestUser) => {
  await assertWalletAccess(user);

  const wallet = await getWalletByUserId(user.id, { createIfMissing: true });
  const totals = await getWalletTotals(user.id);

  return {
    currentBalance: wallet.balance,
    totalEarnings: totals.totalEarnings,
    totalWithdrawals: totals.totalWithdrawn,
    totalPlatformFeesPaid: totals.totalPlatformFeesPaid,
    totalDeposited: totals.totalDeposited,
    totalPaid: totals.totalPaid,
  };
};

export const getWalletTransactionHistory = async (
  user: RequestUser,
  query: WalletTransactionQuery,
) => {
  await assertWalletAccess(user);

  const filter = buildTransactionFilter(user.id, query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    WalletTransaction.countDocuments(filter),
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

export const createWalletDeposit = async (user: RequestUser, input: WalletDepositInput) => {
  assertPositiveAmount(input.amount);

  await assertWalletAccess(user);
  const provider = user.role === "PROVIDER" ? await getProviderByUserId(user.id) : null;
  const wallet = await getWalletByUserId(user.id, { createIfMissing: true });
  const orderCode = buildPayosOrderCode();

  const transaction = await WalletTransaction.create({
    walletId: wallet._id,
    userId: wallet.userId,
    type: "deposit",
    direction: "in",
    amount: input.amount,
    balanceAfter: wallet.balance,
    status: "pending",
    transactionCode: orderCode.toString(),
    gatewayOrderCode: orderCode.toString(),
    gatewayResponse: {
      provider: "payos",
      orderCode,
    },
    description: "Nạp tiền vào ví Handigo",
    metadata: {
      ownerRole: user.role,
      providerId: provider?._id || null,
    },
  });

  let paymentLink;

  try {
    const returnUrl = appendQueryParams(input.returnUrl || DEFAULT_WALLET_DEPOSIT_RETURN_URL, {
      walletDeposit: "success",
      orderCode: orderCode.toString(),
    });
    const cancelUrl = appendQueryParams(input.cancelUrl || DEFAULT_WALLET_DEPOSIT_CANCEL_URL, {
      walletDeposit: "cancelled",
      orderCode: orderCode.toString(),
    });

    paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: input.amount,
      description: "Nạp ví Handigo",
      returnUrl,
      cancelUrl,
      items: [
        {
          name: "Nạp tiền vào ví Handigo",
          quantity: 1,
          price: input.amount,
        },
      ],
    });

    transaction.gatewayPaymentLinkId = paymentLink.paymentLinkId;
    transaction.gatewayResponse = {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      paymentLink,
    };
    await transaction.save();
  } catch (error: any) {
    transaction.status = "failed";
    transaction.gatewayResponse = {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      error: error.message || "Không thể tạo liên kết nạp ví PayOS",
    };
    await transaction.save();
    throw new AppError("Không thể tạo liên kết nạp ví PayOS", 502);
  }

  return {
    transaction,
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode,
    amount: input.amount,
  };
};

export const cancelWalletDeposit = async (user: RequestUser, orderCode: string) => {
  await assertWalletAccess(user);

  const transaction = await WalletTransaction.findOne({
    userId: user.id,
    type: "deposit",
    gatewayOrderCode: orderCode,
    isDeleted: false,
  });

  if (!transaction) {
    throw new AppError("Không tìm thấy giao dịch nạp ví", 404);
  }

  if (transaction.status === "success") {
    return transaction;
  }

  if (transaction.status === "pending") {
    const gatewayResponse = {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      cancelledAt: new Date(),
      cancelledBy: "provider",
      cancelReason: "Nhà cung cấp đã hủy liên kết thanh toán PayOS",
    };
    const cancelledTransaction = await WalletTransaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: "pending",
        isDeleted: false,
      },
      {
        $set: {
          status: "cancelled",
          gatewayResponse,
          description: "Giao dịch nạp ví đã hủy",
        },
      },
      { new: true, runValidators: true },
    );
    return (
      cancelledTransaction ||
      WalletTransaction.findOne({ _id: transaction._id, isDeleted: false })
    );
  }

  return transaction;
};

const markWalletDepositSuccess = async (
  transaction: any,
  gatewayPatch: {
    gatewayTransactionId?: string | null;
    gatewayPaymentLinkId?: string | null;
    gatewayResponse: Record<string, unknown>;
  },
) => {
  const session = await mongoose.startSession();
  let updatedTransaction = transaction;

  try {
    await session.withTransaction(async () => {
      const freshTransaction = await WalletTransaction.findById(transaction._id).session(session);

      if (!freshTransaction) {
        throw new AppError("Không tìm thấy giao dịch nạp ví PayOS", 404);
      }

      if (freshTransaction.status === "success") {
        updatedTransaction = freshTransaction;
        return;
      }
      if (freshTransaction.status === "cancelled") {
        updatedTransaction = freshTransaction;
        return;
      }

      const wallet = await Wallet.findOneAndUpdate(
        { _id: freshTransaction.walletId, isDeleted: false },
        { $inc: { balance: freshTransaction.amount } },
        { new: true, session },
      );

      if (!wallet) {
        throw new WalletError("WALLET_NOT_FOUND", "Không tìm thấy ví", 404);
      }

      freshTransaction.status = "success";
      freshTransaction.balanceAfter = wallet.balance;
      freshTransaction.gatewayTransactionId = gatewayPatch.gatewayTransactionId || null;
      freshTransaction.gatewayPaymentLinkId = gatewayPatch.gatewayPaymentLinkId || null;
      freshTransaction.gatewayResponse = gatewayPatch.gatewayResponse;
      await freshTransaction.save({ session });
      updatedTransaction = freshTransaction;
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("Mã giao dịch PayOS đã được sử dụng", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return updatedTransaction;
};

export const syncWalletDeposit = async (user: RequestUser, orderCode: string) => {
  await assertWalletAccess(user);

  const transaction = await WalletTransaction.findOne({
    userId: user.id,
    type: "deposit",
    gatewayOrderCode: orderCode,
    isDeleted: false,
  });

  if (!transaction) {
    throw new AppError("Không tìm thấy giao dịch nạp ví", 404);
  }

  if (transaction.status === "success" || transaction.status === "cancelled") {
    return transaction;
  }

  const paymentLink = await payos.paymentRequests.get(Number(orderCode));
  const gatewayPatch = {
    gatewayTransactionId: paymentLink.transactions?.[0]?.reference || transaction.gatewayTransactionId || null,
    gatewayPaymentLinkId: paymentLink.id || transaction.gatewayPaymentLinkId || null,
    gatewayResponse: {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      syncedAt: new Date(),
      paymentLink,
    },
  };

  if (paymentLink.status === "PAID" && paymentLink.amountPaid >= transaction.amount) {
    return markWalletDepositSuccess(transaction, gatewayPatch);
  }

  if (["CANCELLED", "EXPIRED", "FAILED"].includes(paymentLink.status)) {
    const syncedTransaction = await WalletTransaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: { $in: ["pending", "failed"] },
        isDeleted: false,
      },
      {
        $set: {
          status:
            paymentLink.status === "CANCELLED" ? "cancelled" : "failed",
          gatewayTransactionId: gatewayPatch.gatewayTransactionId,
          gatewayPaymentLinkId: gatewayPatch.gatewayPaymentLinkId,
          gatewayResponse: gatewayPatch.gatewayResponse,
        },
      },
      { new: true, runValidators: true },
    );
    return (
      syncedTransaction ||
      WalletTransaction.findOne({ _id: transaction._id, isDeleted: false })
    );
  }

  return transaction;
};

export const handleWalletDepositPayosWebhook = async (webhookData: any, payload: any) => {
  const orderCode = webhookData.orderCode?.toString();

  if (!orderCode) {
    throw new AppError("Dữ liệu webhook PayOS không hợp lệ", 400);
  }

  const transaction = await WalletTransaction.findOne({
    type: "deposit",
    gatewayOrderCode: orderCode,
    isDeleted: false,
  });

  if (!transaction) {
    throw new AppError("Không tìm thấy giao dịch nạp ví PayOS", 404);
  }

  const verifiedAmount = Number(webhookData.amount);
  if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
    throw new AppError("Số tiền trong webhook PayOS không hợp lệ", 400);
  }
  if (transaction.amount !== verifiedAmount) {
    throw new AppError("Số tiền webhook PayOS không khớp giao dịch nạp ví", 409);
  }

  const webhookPaymentLinkId = webhookData.paymentLinkId?.toString();
  const webhookReference = webhookData.reference?.toString();
  if (
    transaction.gatewayPaymentLinkId &&
    transaction.gatewayPaymentLinkId !== webhookPaymentLinkId
  ) {
    throw new AppError("Mã liên kết PayOS không khớp giao dịch nạp ví", 409);
  }
  if (
    transaction.gatewayTransactionId &&
    webhookReference &&
    transaction.gatewayTransactionId !== webhookReference
  ) {
    throw new AppError("Mã tham chiếu PayOS không khớp giao dịch nạp ví", 409);
  }

  const isSuccess = webhookData.code === "00";
  if (isSuccess && !webhookReference) {
    throw new AppError("Webhook PayOS thành công thiếu mã tham chiếu giao dịch", 400);
  }
  if (transaction.status === "success" || transaction.status === "cancelled") {
    return transaction;
  }
  const gatewayPatch = {
    gatewayTransactionId: webhookReference || null,
    gatewayPaymentLinkId:
      webhookPaymentLinkId || transaction.gatewayPaymentLinkId || null,
    gatewayResponse: {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      webhook: payload,
      verifiedData: webhookData,
    },
  };

  if (!isSuccess) {
    if (transaction.status === "failed") {
      return transaction;
    }

    const failedTransaction = await WalletTransaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: "pending",
        isDeleted: false,
      },
      {
        $set: {
          status: "failed",
          gatewayTransactionId: gatewayPatch.gatewayTransactionId,
          gatewayPaymentLinkId: gatewayPatch.gatewayPaymentLinkId,
          gatewayResponse: gatewayPatch.gatewayResponse,
        },
      },
      { new: true, runValidators: true },
    );
    return (
      failedTransaction ||
      WalletTransaction.findOne({ _id: transaction._id, isDeleted: false })
    );
  }

  return markWalletDepositSuccess(transaction, gatewayPatch);
};

export const checkSufficientBalance = async (
  providerId: string | Types.ObjectId,
  platformFee: number,
) => {
  assertPositiveAmount(platformFee);

  const { wallet } = await getWalletByProviderId(providerId, { createIfMissing: true });

  return wallet.balance >= platformFee;
};

export const recordCompletedOrderSettlement = async (
  order: IOrder,
  provider: IProvider,
  session: ClientSession,
) => {
  const existingTransaction = await WalletTransaction.findOne({
    relatedOrderId: order._id,
    type: { $in: ["provider_earning", "platform_fee"] },
    status: "success",
    isDeleted: false,
  }).session(session);
  if (existingTransaction) {
    throw new WalletError(
      "INVALID_AMOUNT",
      "Thu nhập của đơn hàng đã được ghi nhận",
      409,
    );
  }

  await assertWalletOwnerActive(provider.userId, session);
  const wallet = await getWalletByUserId(provider.userId, {
    createIfMissing: true,
    session,
  });
  const grossAmount = order.pricing.totalPaidAmount;
  const platformFee = order.pricing.platformCommissionAmount;
  const netEarning = order.pricing.providerEarningAmount;

  if (
    ![grossAmount, platformFee, netEarning].every(Number.isFinite) ||
    grossAmount < 0 ||
    platformFee < 0 ||
    netEarning < 0 ||
    platformFee + netEarning !== grossAmount
  ) {
    throw new WalletError(
      "INVALID_AMOUNT",
      "Dữ liệu doanh thu của đơn hàng không hợp lệ",
      400,
    );
  }

  const balanceBefore = wallet.balance;
  const isCashOrder = order.paymentMethod === "cash";
  if (isCashOrder && balanceBefore < platformFee) {
    throw new WalletError(
      "INSUFFICIENT_BALANCE",
      "Số dư ví không đủ để thanh toán phí nền tảng của đơn hàng",
      400,
    );
  }

  const balanceAfterGross = isCashOrder
    ? balanceBefore
    : balanceBefore + grossAmount;
  const balanceAfterSettlement = balanceAfterGross - platformFee;
  wallet.balance = balanceAfterSettlement;
  await wallet.save({ session });

  const commonMetadata = {
    providerId: provider._id,
    orderId: order._id,
    orderCode: order.orderCode,
    paymentMethod: order.paymentMethod,
    grossAmount,
    platformFee,
    netEarning,
  };

  const earningTransaction = await createWalletTransaction(
    {
      walletId: wallet._id as Types.ObjectId,
      userId: provider.userId,
      relatedOrderId: order._id as Types.ObjectId,
      type: "provider_earning",
      direction: "in",
      amount: grossAmount,
      balanceAfter: balanceAfterGross,
      description: isCashOrder
        ? "Ghi nhận doanh thu tiền mặt khi đơn hàng hoàn tất"
        : "Cộng doanh thu dịch vụ khi đơn hàng hoàn tất",
      transactionCodePrefix: "PROVIDER_EARNING",
      metadata: {
        ...commonMetadata,
        affectsWalletBalance: !isCashOrder,
      },
    },
    session,
  );

  const platformFeeTransaction =
    platformFee > 0
      ? await createWalletTransaction(
          {
            walletId: wallet._id as Types.ObjectId,
            userId: provider.userId,
            relatedOrderId: order._id as Types.ObjectId,
            type: "platform_fee",
            direction: "out",
            amount: platformFee,
            balanceAfter: balanceAfterSettlement,
            description: isCashOrder
              ? "Trừ phí nền tảng của đơn hàng thanh toán tiền mặt"
              : "Khấu trừ phí nền tảng từ doanh thu dịch vụ",
            transactionCodePrefix: "PLATFORM_FEE",
            metadata: {
              ...commonMetadata,
              affectsWalletBalance: true,
            },
          },
          session,
        )
      : null;

  return {
    wallet,
    earningTransaction,
    platformFeeTransaction,
  };
};

export const deductPlatformFee = async (
  providerId: string | Types.ObjectId,
  orderId: string | Types.ObjectId,
  platformFee: number,
) => {
  assertPositiveAmount(platformFee);

  const session = await mongoose.startSession();

  try {
    let createdTransaction = null;

    await session.withTransaction(async () => {
      const provider = await getProviderById(providerId);
      await assertWalletOwnerActive(provider.userId);
      await getWalletByUserId(provider.userId, { createIfMissing: true, session });

      const wallet = await Wallet.findOneAndUpdate(
        {
          userId: provider.userId,
          isDeleted: false,
          balance: { $gte: platformFee },
        },
        { $inc: { balance: -platformFee } },
        { new: true, session },
      );

      if (!wallet) {
        throw new WalletError(
          "INSUFFICIENT_BALANCE",
          "Số dư ví không đủ để trừ phí nền tảng",
          400,
        );
      }

      createdTransaction = await createWalletTransaction(
        {
          walletId: wallet._id as Types.ObjectId,
          userId: provider.userId,
          relatedOrderId: toObjectId(orderId),
          type: "platform_fee",
          direction: "out",
          amount: platformFee,
          balanceAfter: wallet.balance,
          description: "Trừ phí nền tảng khi nhà cung cấp nhận đơn",
          transactionCodePrefix: "PLATFORM_FEE",
          metadata: {
            providerId,
            orderId,
          },
        },
        session,
      );
    });

    return createdTransaction;
  } finally {
    await session.endSession();
  }
};

export const addProviderEarning = async (
  providerId: string | Types.ObjectId,
  orderId: string | Types.ObjectId,
  amount: number,
) => {
  assertPositiveAmount(amount);

  const session = await mongoose.startSession();

  try {
    let createdTransaction = null;

    await session.withTransaction(async () => {
      const provider = await getProviderById(providerId);
      await assertWalletOwnerActive(provider.userId);
      const wallet = await getWalletByUserId(provider.userId, {
        createIfMissing: true,
        session,
      });

      wallet.balance += amount;
      await wallet.save({ session });

      createdTransaction = await createWalletTransaction(
        {
          walletId: wallet._id as Types.ObjectId,
          userId: provider.userId,
          relatedOrderId: toObjectId(orderId),
          type: "provider_earning",
          direction: "in",
          amount,
          balanceAfter: wallet.balance,
          description: "Cộng tiền thu nhập sau khi đơn hàng hoàn tất",
          transactionCodePrefix: "PROVIDER_EARNING",
          metadata: {
            providerId,
            orderId,
          },
        },
        session,
      );
    });

    return createdTransaction;
  } finally {
    await session.endSession();
  }
};

export const refundWallet = async (
  providerId: string | Types.ObjectId,
  orderId: string | Types.ObjectId,
  amount: number,
) => {
  assertPositiveAmount(amount);

  const session = await mongoose.startSession();

  try {
    let createdTransaction = null;

    await session.withTransaction(async () => {
      const provider = await getProviderById(providerId);
      await assertWalletOwnerActive(provider.userId);
      const wallet = await getWalletByUserId(provider.userId, {
        createIfMissing: true,
        session,
      });

      wallet.balance += amount;
      await wallet.save({ session });

      createdTransaction = await createWalletTransaction(
        {
          walletId: wallet._id as Types.ObjectId,
          userId: provider.userId,
          relatedOrderId: toObjectId(orderId),
          type: "refund",
          direction: "in",
          amount,
          balanceAfter: wallet.balance,
          description: "Hoàn tiền vào ví",
          transactionCodePrefix: "REFUND",
          metadata: {
            providerId,
            orderId,
          },
        },
        session,
      );
    });

    return createdTransaction;
  } finally {
    await session.endSession();
  }
};

export const getAdminWallets = async (query: AdminWalletListQuery) => {
  const userFilter: Record<string, unknown> = {
    role: "PROVIDER",
    isDeleted: false,
  };

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");
    userFilter.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const users = await User.find(userFilter).select("_id fullName email phone status");
  const userIds = users.map((user) => user._id);
  const providers = await Provider.find({ userId: { $in: userIds }, isDeleted: false });
  const providerByUserId = new Map(
    providers.map((provider) => [provider.userId.toString(), provider]),
  );
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  const wallets = await Wallet.find({
    userId: { $in: providers.map((provider) => provider.userId) },
    isDeleted: false,
  }).sort({ balance: query.sortByBalance === "asc" ? 1 : -1 });

  const walletByUserId = new Map(wallets.map((wallet) => [wallet.userId.toString(), wallet]));
  const rows = providers
    .map((provider) => {
      const user = userById.get(provider.userId.toString());
      const wallet = walletByUserId.get(provider.userId.toString());

      return {
        providerId: provider._id,
        provider: user
          ? {
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
              status: user.status,
            }
          : null,
        balance: wallet?.balance || 0,
        pendingBalance: wallet?.pendingBalance || 0,
        currency: wallet?.currency || "VND",
        walletId: wallet?._id || null,
      };
    })
    .sort((a, b) =>
      query.sortByBalance === "asc" ? a.balance - b.balance : b.balance - a.balance,
    );

  const total = rows.length;
  const start = (query.page - 1) * query.limit;
  const items = rows.slice(start, start + query.limit);

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

export const getAdminWalletByProviderId = async (providerId: string) => {
  const { provider, wallet } = await getWalletByProviderId(providerId, {
    createIfMissing: true,
  });
  const user = await User.findById(provider.userId).select("fullName email phone status");
  const totals = await getWalletTotals(provider.userId);

  return {
    providerId: provider._id,
    provider: user,
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance,
    currency: wallet.currency,
    totalEarnings: totals.totalEarnings,
    totalWithdrawn: totals.totalWithdrawn,
    totalPlatformFeesPaid: totals.totalPlatformFeesPaid,
    totalDeposited: totals.totalDeposited,
    totalPaid: totals.totalPaid,
  };
};

export const getAdminWalletTransactions = async (
  providerId: string,
  query: WalletTransactionQuery,
) => {
  const { provider } = await getWalletByProviderId(providerId, {
    createIfMissing: true,
  });
  const filter = buildTransactionFilter(provider.userId, query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    WalletTransaction.countDocuments(filter),
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

export const adjustWallet = async (
  providerId: string,
  adminId: string,
  input: AdminWalletAdjustmentInput,
) => {
  assertPositiveAmount(input.amount);

  const session = await mongoose.startSession();

  try {
    let createdTransaction = null;

    await session.withTransaction(async () => {
      const provider = await getProviderById(providerId);
      await assertWalletOwnerActive(provider.userId);
      await getWalletByUserId(provider.userId, { createIfMissing: true, session });

      const update =
        input.direction === "in"
          ? { $inc: { balance: input.amount } }
          : { $inc: { balance: -input.amount } };
      const filter =
        input.direction === "in"
          ? { userId: provider.userId, isDeleted: false }
          : {
              userId: provider.userId,
              isDeleted: false,
              balance: { $gte: input.amount },
            };

      const wallet = await Wallet.findOneAndUpdate(filter, update, {
        new: true,
        session,
      });

      if (!wallet) {
        throw new WalletError(
          "INSUFFICIENT_BALANCE",
          "Số dư ví không đủ để điều chỉnh giảm",
          400,
        );
      }

      createdTransaction = await createWalletTransaction(
        {
          walletId: wallet._id as Types.ObjectId,
          userId: provider.userId,
          type: "adjustment",
          direction: input.direction,
          amount: input.amount,
          balanceAfter: wallet.balance,
          description: input.reason,
          transactionCodePrefix: "ADJUSTMENT",
          metadata: {
            adminId,
            reason: input.reason,
            providerId,
          },
        },
        session,
      );
    });

    return createdTransaction;
  } finally {
    await session.endSession();
  }
};

export const walletErrorCodes = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  WALLET_NOT_FOUND: "WALLET_NOT_FOUND",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  WALLET_LOCKED: "WALLET_LOCKED",
} as const;
