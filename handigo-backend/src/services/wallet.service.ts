import mongoose, { ClientSession, Types } from "mongoose";
import { payos } from "../configs/payos.config";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
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

type RequestUser = {
  id: string;
  role: string;
};

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

const buildTransactionCode = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const buildPayosOrderCode = () =>
  Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12));

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

const toObjectId = (id: string | Types.ObjectId) =>
  typeof id === "string" ? new Types.ObjectId(id) : id;

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

const assertWalletOwnerActive = async (userId: string | Types.ObjectId) => {
  const user = await User.findById(userId).select("status");

  if (!user || user.isDeleted) {
    throw new WalletError("WALLET_NOT_FOUND", "Không tìm thấy chủ ví", 404);
  }

  if (user.status === "locked") {
    throw new WalletError("WALLET_LOCKED", "Ví đang bị khóa", 423);
  }
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
  const [totalEarnings, totalWithdrawn, totalPlatformFeesPaid] = await Promise.all([
    sumTransactions(userId, "provider_earning", "in"),
    sumTransactions(userId, "withdraw", "out"),
    sumTransactions(userId, "platform_fee", "out"),
  ]);

  return {
    totalEarnings,
    totalWithdrawn,
    totalPlatformFeesPaid,
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
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Bạn không có quyền truy cập ví này", 403);
  }

  await getProviderByUserId(user.id);
  await assertWalletOwnerActive(user.id);

  const wallet = await getWalletByUserId(user.id, { createIfMissing: true });
  const totals = await getWalletTotals(user.id);

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance,
    totalEarnings: totals.totalEarnings,
    totalWithdrawn: totals.totalWithdrawn,
  };
};

export const getWalletSummary = async (user: RequestUser) => {
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Bạn không có quyền truy cập ví này", 403);
  }

  await getProviderByUserId(user.id);
  await assertWalletOwnerActive(user.id);

  const wallet = await getWalletByUserId(user.id, { createIfMissing: true });
  const totals = await getWalletTotals(user.id);

  return {
    currentBalance: wallet.balance,
    totalEarnings: totals.totalEarnings,
    totalWithdrawals: totals.totalWithdrawn,
    totalPlatformFeesPaid: totals.totalPlatformFeesPaid,
  };
};

export const getWalletTransactionHistory = async (
  user: RequestUser,
  query: WalletTransactionQuery,
) => {
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Bạn không có quyền truy cập ví này", 403);
  }

  await getProviderByUserId(user.id);
  await assertWalletOwnerActive(user.id);

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
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Ban khong co quyen nap vi nay", 403);
  }

  assertPositiveAmount(input.amount);

  const provider = await getProviderByUserId(user.id);
  await assertWalletOwnerActive(user.id);
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
    description: "Nap tien vao vi provider",
    metadata: {
      providerId: provider._id,
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
      description: "Nap vi Handigo",
      returnUrl,
      cancelUrl,
      items: [
        {
          name: "Nap tien vao vi Handigo",
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
      error: error.message || "Khong the tao lien ket nap vi PayOS",
    };
    await transaction.save();
    throw new AppError("Khong the tao lien ket nap vi PayOS", 502);
  }

  return {
    transaction,
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode,
    amount: input.amount,
  };
};

export const cancelWalletDeposit = async (user: RequestUser, orderCode: string) => {
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Ban khong co quyen huy giao dich nay", 403);
  }

  await getProviderByUserId(user.id);

  const transaction = await WalletTransaction.findOne({
    userId: user.id,
    type: "deposit",
    gatewayOrderCode: orderCode,
    isDeleted: false,
  });

  if (!transaction) {
    throw new AppError("Khong tim thay giao dich nap vi", 404);
  }

  if (transaction.status === "success") {
    return transaction;
  }

  if (transaction.status === "pending") {
    transaction.status = "cancelled";
    transaction.gatewayResponse = {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      cancelledAt: new Date(),
      cancelledBy: "provider",
      cancelReason: "Provider cancelled PayOS payment link",
    };
    transaction.description = "Giao dich nap vi da huy";
    await transaction.save();
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
  } finally {
    await session.endSession();
  }

  return updatedTransaction;
};

export const syncWalletDeposit = async (user: RequestUser, orderCode: string) => {
  if (user.role !== "PROVIDER") {
    throw new WalletError("UNAUTHORIZED_ACCESS", "Bạn không có quyền đồng bộ giao dịch này", 403);
  }

  await getProviderByUserId(user.id);

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
    transaction.status = paymentLink.status === "CANCELLED" ? "cancelled" : "failed";
    transaction.gatewayTransactionId = gatewayPatch.gatewayTransactionId;
    transaction.gatewayPaymentLinkId = gatewayPatch.gatewayPaymentLinkId;
    transaction.gatewayResponse = gatewayPatch.gatewayResponse;
    await transaction.save();
  }

  return transaction;
};

export const handleWalletDepositPayosWebhook = async (webhookData: any, payload: any) => {
  const orderCode = webhookData.orderCode?.toString();

  if (!orderCode) {
    throw new AppError("Du lieu webhook PayOS khong hop le", 400);
  }

  const transaction = await WalletTransaction.findOne({
    type: "deposit",
    gatewayOrderCode: orderCode,
  });

  if (!transaction) {
    throw new AppError("Khong tim thay giao dich nap vi PayOS", 404);
  }

  if (transaction.status === "success") {
    return transaction;
  }

  if (transaction.status === "cancelled") {
    return transaction;
  }

  const isSuccess = payload.success === true && webhookData.code === "00";
  const gatewayPatch = {
    gatewayTransactionId: webhookData.reference || null,
    gatewayPaymentLinkId: webhookData.paymentLinkId || transaction.gatewayPaymentLinkId || null,
    gatewayResponse: {
      ...((transaction.gatewayResponse as Record<string, unknown>) || {}),
      webhook: payload,
      verifiedData: webhookData,
    },
  };

  if (!isSuccess) {
    transaction.status = "failed";
    transaction.gatewayTransactionId = gatewayPatch.gatewayTransactionId;
    transaction.gatewayPaymentLinkId = gatewayPatch.gatewayPaymentLinkId;
    transaction.gatewayResponse = gatewayPatch.gatewayResponse;
    await transaction.save();
    return transaction;
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
