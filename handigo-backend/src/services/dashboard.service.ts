import { PipelineStage, Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { Provider } from "../models/provider.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { WithdrawRequest } from "../models/withdrawRequest.model";
import { AppError } from "../utils/appError";
import type { DashboardQuery } from "../validations/dashboard.validator";

const dateMatch = (query: DashboardQuery, field = "createdAt") => {
  const range: Record<string, Date> = {};

  if (query.fromDate) range.$gte = query.fromDate;
  if (query.toDate) range.$lte = query.toDate;

  return Object.keys(range).length ? { [field]: range } : {};
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const sumAggregate = async (
  model: { aggregate: (pipeline: PipelineStage[]) => Promise<Array<{ total?: number }>> },
  match: Record<string, unknown>,
  amountExpression: string | Record<string, unknown>,
) => {
  const [result] = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: amountExpression } } },
  ]);

  return result?.total || 0;
};

const formatGroup = (format: string): Record<string, unknown> => ({
  $dateToString: { format, date: "$createdAt" },
});

const seriesAggregate = async (
  model: { aggregate: (pipeline: PipelineStage[]) => Promise<Array<{ _id: string; amount: number; count?: number }>> },
  match: Record<string, unknown>,
  format: string,
  amountExpression: string | Record<string, unknown>,
  label: string,
) => {
  const rows = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: formatGroup(format),
        amount: { $sum: amountExpression },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        [label]: "$_id",
        amount: 1,
        count: 1,
      },
    },
  ]);

  return rows;
};

const basePaymentMatch = (query: DashboardQuery) => ({
  status: "paid",
  isDeleted: false,
  ...dateMatch(query),
});

const baseOrderMatch = (query: DashboardQuery) => ({
  isDeleted: false,
  ...dateMatch(query),
});

const baseTransactionMatch = (query: DashboardQuery) => ({
  status: "success",
  isDeleted: false,
  ...dateMatch(query),
});

const baseWithdrawalMatch = (query: DashboardQuery) => ({
  isDeleted: false,
  ...dateMatch(query),
});

const currentMonthQuery = (): Pick<DashboardQuery, "fromDate" | "toDate"> => {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { fromDate, toDate };
};

const getProviderForUser = async (userId: string) => {
  const provider = await Provider.findOne({
    userId: new Types.ObjectId(userId),
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
  }

  return provider;
};

export const getAdminOverview = async (query: DashboardQuery) => {
  const [
    revenue,
    platformRevenue,
    orderStats,
    withdrawalStats,
    providerEarnings,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: basePaymentMatch(query) },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalDeposits: {
            $sum: {
              $cond: [{ $eq: ["$paymentType", "inspection_deposit"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
    sumAggregate(
      WalletTransaction,
      { ...baseTransactionMatch(query), type: "platform_fee", direction: "out" },
      "$amount",
    ),
    Order.aggregate([
      { $match: baseOrderMatch(query) },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]),
    WithdrawRequest.aggregate([
      { $match: baseWithdrawalMatch(query) },
      {
        $group: {
          _id: null,
          totalWithdrawals: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$amount", 0] },
          },
          pendingWithdrawalAmount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
          },
          pendingWithdrawals: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
    ]),
    sumAggregate(
      WalletTransaction,
      { ...baseTransactionMatch(query), type: "provider_earning", direction: "in" },
      "$amount",
    ),
  ]);

  return {
    totalRevenue: revenue[0]?.totalRevenue || 0,
    platformRevenue,
    totalOrders: orderStats[0]?.totalOrders || 0,
    completedOrders: orderStats[0]?.completedOrders || 0,
    cancelledOrders: orderStats[0]?.cancelledOrders || 0,
    totalDeposits: revenue[0]?.totalDeposits || 0,
    totalWithdrawals: withdrawalStats[0]?.totalWithdrawals || 0,
    providerEarnings,
    pendingWithdrawals: withdrawalStats[0]?.pendingWithdrawals || 0,
    pendingWithdrawalAmount: withdrawalStats[0]?.pendingWithdrawalAmount || 0,
  };
};

export const getAdminRevenue = async (query: DashboardQuery) => {
  const paidPaymentMatch = basePaymentMatch(query);
  const platformFeeMatch = {
    ...baseTransactionMatch(query),
    type: "platform_fee",
    direction: "out",
  };
  const completedOrderMatch = {
    ...baseOrderMatch(query),
    status: "completed",
  };
  const depositMatch = {
    ...paidPaymentMatch,
    paymentType: "inspection_deposit",
  };

  const [
    revenueByDay,
    revenueByWeek,
    revenueByMonth,
    platformFeeByMonth,
    completedOrderRevenueByMonth,
    depositRevenueByMonth,
    platformFeeRevenue,
    completedOrderRevenue,
    depositRevenue,
  ] = await Promise.all([
    seriesAggregate(Payment, paidPaymentMatch, "%Y-%m-%d", "$amount", "day"),
    seriesAggregate(Payment, paidPaymentMatch, "%G-W%V", "$amount", "week"),
    seriesAggregate(Payment, paidPaymentMatch, "%Y-%m", "$amount", "month"),
    seriesAggregate(WalletTransaction, platformFeeMatch, "%Y-%m", "$amount", "month"),
    seriesAggregate(Order, completedOrderMatch, "%Y-%m", "$pricing.totalPaidAmount", "month"),
    seriesAggregate(Payment, depositMatch, "%Y-%m", "$amount", "month"),
    sumAggregate(WalletTransaction, platformFeeMatch, "$amount"),
    sumAggregate(Order, completedOrderMatch, "$pricing.totalPaidAmount"),
    sumAggregate(Payment, depositMatch, "$amount"),
  ]);

  return {
    revenueByDay,
    revenueByWeek,
    revenueByMonth,
    platformFeeRevenue,
    completedOrderRevenue,
    depositRevenue,
    platformFeeByMonth,
    completedOrderRevenueByMonth,
    depositRevenueByMonth,
  };
};

export const getAdminOrders = async (query: DashboardQuery) => {
  const orderMatch = baseOrderMatch(query);
  const [ordersByStatus, ordersByServiceCategory, ordersByMonth, totals] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "service.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$category._id",
          categoryId: { $first: "$category._id" },
          categoryName: { $first: { $ifNull: ["$category.name", "Chưa phân loại"] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, categoryId: 1, categoryName: 1, count: 1 } },
    ]),
    seriesAggregate(Order, orderMatch, "%Y-%m", { $literal: 1 }, "month"),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const total = totals[0]?.total || 0;
  const completed = totals[0]?.completed || 0;
  const cancelled = totals[0]?.cancelled || 0;

  return {
    ordersByStatus,
    ordersByServiceCategory,
    ordersByMonth: ordersByMonth.map((row) => ({
      month: (row as any).month,
      count: row.amount,
    })),
    completionRate: total ? completed / total : 0,
    cancellationRate: total ? cancelled / total : 0,
  };
};

export const getAdminProviders = async (query: DashboardQuery) => {
  const providerMatch = { isDeleted: false };
  const transactionMatch = {
    ...baseTransactionMatch(query),
    type: "provider_earning",
    direction: "in",
  };
  const completedOrderMatch = {
    ...baseOrderMatch(query),
    status: "completed",
    providerId: { $ne: null },
  };

  const [
    totalProviders,
    activeProviders,
    onlineProviders,
    averageRating,
    topProvidersByRevenue,
    topProvidersByCompletedOrders,
  ] = await Promise.all([
    Provider.countDocuments(providerMatch),
    Provider.aggregate([
      { $match: providerMatch },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.status": "active", "user.isDeleted": false } },
      { $count: "total" },
    ]),
    Provider.countDocuments({ ...providerMatch, availabilityStatus: "online" }),
    Provider.aggregate([
      { $match: providerMatch },
      { $group: { _id: null, averageRating: { $avg: "$averageRating" } } },
    ]),
    WalletTransaction.aggregate([
      { $match: transactionMatch },
      { $group: { _id: "$userId", revenue: { $sum: "$amount" } } },
      { $sort: { revenue: -1 } },
      { $limit: query.topLimit },
      {
        $lookup: {
          from: "providers",
          localField: "_id",
          foreignField: "userId",
          as: "provider",
        },
      },
      { $unwind: "$provider" },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          providerId: "$provider._id",
          userId: "$_id",
          fullName: "$user.fullName",
          email: "$user.email",
          revenue: 1,
          averageRating: "$provider.averageRating",
          completedOrders: "$provider.totalCompletedOrders",
        },
      },
    ]),
    Order.aggregate([
      { $match: completedOrderMatch },
      { $group: { _id: "$providerId", completedOrders: { $sum: 1 } } },
      { $sort: { completedOrders: -1 } },
      { $limit: query.topLimit },
      {
        $lookup: {
          from: "providers",
          localField: "_id",
          foreignField: "_id",
          as: "provider",
        },
      },
      { $unwind: "$provider" },
      {
        $lookup: {
          from: "users",
          localField: "provider.userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          providerId: "$_id",
          userId: "$provider.userId",
          fullName: "$user.fullName",
          email: "$user.email",
          completedOrders: 1,
          averageRating: "$provider.averageRating",
        },
      },
    ]),
  ]);

  return {
    totalProviders,
    activeProviders: activeProviders[0]?.total || 0,
    onlineProviders,
    averageProviderRating: averageRating[0]?.averageRating || 0,
    topProvidersByRevenue,
    topProvidersByCompletedOrders,
  };
};

export const getProviderOverview = async (user: RequestUser, query: DashboardQuery) => {
  const provider = await getProviderForUser(user.id);
  const providerUserId = new Types.ObjectId(user.id);
  const providerDateQuery = query.fromDate || query.toDate ? query : { ...query, ...currentMonthQuery() };

  const [wallet, monthlyEarnings, completedOrders, pendingWithdrawals] = await Promise.all([
    Wallet.findOne({ userId: providerUserId, isDeleted: false }),
    sumAggregate(
      WalletTransaction,
      {
        ...baseTransactionMatch(providerDateQuery as DashboardQuery),
        userId: providerUserId,
        type: "provider_earning",
        direction: "in",
      },
      "$amount",
    ),
    Order.countDocuments({
      ...baseOrderMatch(query),
      providerId: provider._id,
      status: "completed",
    }),
    WithdrawRequest.aggregate([
      {
        $match: {
          ...baseWithdrawalMatch(query),
          userId: providerUserId,
          status: "pending",
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    walletBalance: wallet?.balance || 0,
    pendingBalance: wallet?.pendingBalance || 0,
    monthlyEarnings,
    completedOrders,
    averageRating: provider.averageRating || 0,
    availabilityStatus: provider.availabilityStatus || "offline",
    pendingWithdrawals: pendingWithdrawals[0]?.count || 0,
    pendingWithdrawalAmount: pendingWithdrawals[0]?.amount || 0,
  };
};

export const updateProviderAvailability = async (
  user: RequestUser,
  availabilityStatus: "online" | "offline" | "busy",
) => {
  const provider = await getProviderForUser(user.id);
  provider.availabilityStatus = availabilityStatus;
  await provider.save();

  return {
    availabilityStatus: provider.availabilityStatus,
  };
};

export const getProviderEarnings = async (user: RequestUser, query: DashboardQuery) => {
  const provider = await getProviderForUser(user.id);
  const providerUserId = new Types.ObjectId(user.id);
  const transactionMatch = {
    ...baseTransactionMatch(query),
    userId: providerUserId,
    type: "provider_earning",
    direction: "in",
  };
  const completedOrderMatch = {
    ...baseOrderMatch(query),
    providerId: provider._id,
    status: "completed",
  };
  const skip = (query.page - 1) * query.limit;
  const sortDirection = query.sortOrder === "asc" ? 1 : -1;

  const [
    earningsByDay,
    earningsByWeek,
    earningsByMonth,
    completedOrders,
    recentTransactionsResult,
  ] = await Promise.all([
    seriesAggregate(WalletTransaction, transactionMatch, "%Y-%m-%d", "$amount", "day"),
    seriesAggregate(WalletTransaction, transactionMatch, "%G-W%V", "$amount", "week"),
    seriesAggregate(WalletTransaction, transactionMatch, "%Y-%m", "$amount", "month"),
    Order.aggregate([
      { $match: completedOrderMatch },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$pricing.providerEarningAmount" } } },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          ...baseTransactionMatch(query),
          userId: providerUserId,
        },
      },
      {
        $facet: {
          items: [
            { $sort: { createdAt: sortDirection } },
            { $skip: skip },
            { $limit: query.limit },
            {
              $project: {
                _id: 0,
                id: "$_id",
                type: 1,
                direction: 1,
                amount: 1,
                balanceAfter: 1,
                status: 1,
                description: 1,
                metadata: 1,
                relatedOrderId: 1,
                relatedPaymentId: 1,
                relatedWithdrawRequestId: 1,
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]),
  ]);

  const recentTransactions = recentTransactionsResult[0] || { items: [], total: [] };
  const total = recentTransactions.total[0]?.count || 0;

  return {
    earningsByDay,
    earningsByWeek,
    earningsByMonth,
    completedOrders: {
      count: completedOrders[0]?.count || 0,
      amount: completedOrders[0]?.amount || 0,
    },
    recentTransactions: {
      items: recentTransactions.items,
      pagination: pagination(query.page, query.limit, total),
    },
  };
};
