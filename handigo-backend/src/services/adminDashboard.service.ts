import User from "../models/user.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { ProviderApplication } from "../models/providerApplication.model";
import { SupportTicket } from "../models/supportTicket.model";
import { Complaint } from "../models/complaint.model";
import { Feedback } from "../models/feedback.model";
import { ServiceSuggestion } from "../models/serviceSuggestion.model";
import { WithdrawRequest } from "../models/withdrawRequest.model";
import { Report } from "../models/report.model";
import { Refund } from "../models/refund.model";
import { getOnlineUserIds } from "../sockets/socketServer";
import type { AdminDashboardQuery } from "../validations/adminDashboard.validator";
import { compareMetric, getInsightsPeriod, getMonthlyComparisonPeriod, orderAttentionConditions } from "./adminDashboardMetrics";

export const getAdminUserPresence = async () => {
  const now = new Date();
  const [totalRegisteredUsers, ids, newUsersLast7Days] = await Promise.all([
    User.countDocuments({ isDeleted: false }), getOnlineUserIds(),
    User.countDocuments({ isDeleted: false, createdAt: { $gte: new Date(now.getTime() - 7 * 86_400_000), $lte: now } }),
  ]);
  const onlineUsers = ids === null ? null : ids.length === 0 ? 0 : await User.countDocuments({
    _id: { $in: ids }, isDeleted: false, status: "active",
  });
  return { totalRegisteredUsers, onlineUsers, newUsersLast7Days, asOf: now };
};

type Period = ReturnType<typeof getInsightsPeriod>;
const inRange = (field: string, from: Date, to: Date) => ({ $and: [{ $gte: [field, from] }, { $lte: [field, to] }] });
const sumWhen = (condition: Record<string, unknown>, amount: unknown = 1) => ({ $sum: { $cond: [condition, amount, 0] } });

const getPendingWork = async () => {
  const [applications, support, complaints, suggestions, withdrawals] = await Promise.all([
    ProviderApplication.countDocuments({ isDeleted: false, status: { $in: ["pending", "resubmitted"] } }),
    SupportTicket.countDocuments({ isDeleted: false, status: { $in: ["open", "in_progress"] }, responses: { $not: { $elemMatch: { responderRole: "ADMIN" } } } }),
    Complaint.countDocuments({ isDeleted: false, status: { $in: ["pending", "evidence_requested", "under_review"] } }),
    ServiceSuggestion.countDocuments({ isDeleted: false, status: "pending" }),
    WithdrawRequest.aggregate<{ count: number; amount: number }>([
      { $match: { isDeleted: false, status: "pending" } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
  ]);
  return { applications, support, complaints, suggestions, withdrawals: withdrawals[0]?.count ?? 0, withdrawalAmount: withdrawals[0]?.amount ?? 0 };
};

/** Số việc hiện tại cho sidebar, dùng chung quy tắc hàng đợi với Tổng quan. */
export const getAdminPendingCounts = async () => {
  const now = new Date();
  const [work, attentionOrders, reports, refunds] = await Promise.all([
    getPendingWork(),
    Order.countDocuments({ isDeleted: false, $or: Object.values(orderAttentionConditions(now)) }),
    Report.countDocuments({ isDeleted: false, status: { $in: ["pending", "under_review"] } }),
    Refund.countDocuments({ isDeleted: false, status: { $in: ["failed", "manual_review"] } }),
  ]);
  return { ...work, attentionOrders, reports, refunds, asOf: now };
};

const getAttentionOrders = async (now: Date) => {
  const conditions = orderAttentionConditions(now);
  const facets = Object.fromEntries(Object.entries(conditions).map(([name, condition]) => [name, [{ $match: condition }, { $count: "count" }]]));
  const [result] = await Order.aggregate<{
    awaitingProvider: Array<{ count: number }>; lateArrival: Array<{ count: number }>; overdue: Array<{ count: number }>;
    items: Array<{ _id: string; orderCode: string; status: string; scheduledAt?: Date; schedule?: { expectedStartAt?: Date; expectedEndAt?: Date }; createdAt: Date }>;
  }>([
    { $match: { isDeleted: false, status: { $in: ["created", "accepted", "in_progress"] }, $or: Object.values(conditions) } },
    { $facet: { ...facets, items: [
      { $sort: { createdAt: 1, _id: 1 } }, { $limit: 5 },
      { $project: { orderCode: 1, status: 1, scheduledAt: 1, "schedule.expectedStartAt": 1, "schedule.expectedEndAt": 1, createdAt: 1 } },
    ] } },
  ]);
  return {
    awaitingProvider: result?.awaitingProvider[0]?.count ?? 0,
    lateArrival: result?.lateArrival[0]?.count ?? 0,
    overdue: result?.overdue[0]?.count ?? 0,
    items: (result?.items ?? []).map((item) => ({
      id: item._id, orderCode: item.orderCode, status: item.status,
      expectedAt: item.status === "accepted" ? item.schedule?.expectedStartAt ?? item.scheduledAt ?? null
        : item.status === "in_progress" ? item.schedule?.expectedEndAt ?? null : null,
      createdAt: item.createdAt,
    })),
  };
};

const getComparison = async (period: Period) => {
  const { fromDate, toDate, previousFromDate } = period;
  const match = { isDeleted: false, createdAt: { $gte: previousFromDate, $lte: toDate } };
  const groupPeriod = { $cond: [{ $gte: ["$createdAt", fromDate] }, "current", "previous"] };
  const [orders, fees] = await Promise.all([
    Order.aggregate<{ _id: string; count: number; cancelled: number }>([
      { $match: match },
      { $group: { _id: groupPeriod, count: { $sum: 1 }, cancelled: sumWhen({ $eq: ["$status", "cancelled"] }) } },
    ]),
    WalletTransaction.aggregate<{ _id: string; amount: number }>([
      { $match: { ...match, type: "platform_fee", direction: "out", status: "success" } },
      { $group: { _id: groupPeriod, amount: { $sum: "$amount" } } },
    ]),
  ]);
  const current = orders.find((row) => row._id === "current");
  const previous = orders.find((row) => row._id === "previous");
  const currentRate = current?.count ? current.cancelled / current.count * 100 : 0;
  const previousRate = previous?.count ? previous.cancelled / previous.count * 100 : 0;
  return {
    orders: compareMetric(current?.count ?? 0, previous?.count ?? 0),
    platformRevenue: compareMetric(fees.find((row) => row._id === "current")?.amount ?? 0, fees.find((row) => row._id === "previous")?.amount ?? 0),
    cancellationRate: { current: currentRate, previous: previousRate, changePoints: currentRate - previousRate },
  };
};

const getCustomers = async ({ fromDate, toDate }: Period) => {
  const [newCustomers, activity] = await Promise.all([
    User.countDocuments({ isDeleted: false, role: "CUSTOMER", createdAt: { $gte: fromDate, $lte: toDate } }),
    Order.aggregate<{ bookingCustomers: number; returningCustomers: number }>([
      { $match: { isDeleted: false, status: { $ne: "cancelled" }, createdAt: { $lte: toDate } } },
      { $group: { _id: "$customerId", total: { $sum: 1 }, inPeriod: sumWhen(inRange("$createdAt", fromDate, toDate)) } },
      { $match: { inPeriod: { $gt: 0 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $match: { "user.isDeleted": false } },
      { $group: { _id: null, bookingCustomers: { $sum: 1 }, returningCustomers: sumWhen({ $gte: ["$total", 2] }) } },
    ]),
  ]);
  return { newCustomers, bookingCustomers: activity[0]?.bookingCustomers ?? 0, returningCustomers: activity[0]?.returningCustomers ?? 0 };
};

const getDeposits = async ({ fromDate, toDate }: Period) => {
  const [result] = await Payment.aggregate<{
    heldAmount: number; heldCount: number; receivedAmount: number; refundedAmount: number;
    compensatedAmount: number; pendingRefundAmount: number;
  }>([
    { $match: { isDeleted: false, paymentType: "inspection_deposit", status: { $in: ["paid", "refunded"] } } },
    { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" }, { $match: { "order.isDeleted": false } },
    { $lookup: { from: "refunds", localField: "_id", foreignField: "paymentId", as: "refund" } },
    { $set: {
      isHeld: { $and: [{ $eq: ["$status", "paid"] }, { $in: ["$order.status", ["created", "accepted", "in_progress"]] }, { $eq: [{ $ifNull: ["$compensatedToProviderId", null] }, null] }] },
      pendingRefund: { $filter: { input: "$refund", as: "item", cond: { $and: [{ $eq: ["$$item.isDeleted", false] }, { $in: ["$$item.status", ["requested", "requesting", "pending", "failed", "manual_review"]] }] } } },
    } },
    { $group: {
      _id: null,
      heldAmount: sumWhen({ $eq: ["$isHeld", true] }, "$amount"),
      heldCount: sumWhen({ $eq: ["$isHeld", true] }),
      receivedAmount: sumWhen(inRange("$paidAt", fromDate, toDate), "$amount"),
      refundedAmount: sumWhen({ $and: [{ $eq: ["$status", "refunded"] }, inRange("$refundedAt", fromDate, toDate)] }, { $ifNull: ["$metadata.refund.amount", "$amount"] }),
      compensatedAmount: sumWhen({ $and: [{ $ne: [{ $ifNull: ["$compensatedToProviderId", null] }, null] }, inRange("$compensatedAt", fromDate, toDate)] }, { $ifNull: ["$metadata.cancellationCompensation.amount", "$amount"] }),
      pendingRefundAmount: { $sum: { $sum: "$pendingRefund.amount" } },
    } },
  ]);
  return result ? {
    heldAmount: result.heldAmount, heldCount: result.heldCount, receivedAmount: result.receivedAmount,
    refundedAmount: result.refundedAmount, compensatedAmount: result.compensatedAmount, pendingRefundAmount: result.pendingRefundAmount,
  } : { heldAmount: 0, heldCount: 0, receivedAmount: 0, refundedAmount: 0, compensatedAmount: 0, pendingRefundAmount: 0 };
};

export const getAdminRatingStats = async ({ fromDate, toDate, previousFromDate }: Period) => {
  type RatingSummary = {
    averageRating: number; ratedOrders: number; fiveStar: number; fourToFive: number;
    belowFour: number; belowThree: number; belowTwo: number;
  };
  const rows = await Feedback.aggregate<RatingSummary & { _id: string }>([
    { $match: { isDeleted: false, rating: { $gte: 1, $lte: 5 }, createdAt: { $gte: previousFromDate, $lte: toDate } } },
    { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.isDeleted": false, "order.status": "completed" } },
    // Mỗi đơn chỉ đóng góp một đánh giá, kể cả dữ liệu cũ bị trùng.
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: "$orderId", rating: { $first: "$rating" }, createdAt: { $first: "$createdAt" } } },
    { $group: {
      _id: { $cond: [{ $gte: ["$createdAt", fromDate] }, "current", "previous"] },
      averageRating: { $avg: "$rating" }, ratedOrders: { $sum: 1 },
      fiveStar: sumWhen({ $eq: ["$rating", 5] }),
      fourToFive: sumWhen({ $and: [{ $gte: ["$rating", 4] }, { $lt: ["$rating", 5] }] }),
      belowFour: sumWhen({ $lt: ["$rating", 4] }),
      belowThree: sumWhen({ $lt: ["$rating", 3] }),
      belowTwo: sumWhen({ $lt: ["$rating", 2] }),
    } },
  ]);
  const summary = (key: string): RatingSummary => {
    const row = rows.find((item) => item._id === key);
    return {
      averageRating: row?.averageRating ?? 0, ratedOrders: row?.ratedOrders ?? 0,
      fiveStar: row?.fiveStar ?? 0, fourToFive: row?.fourToFive ?? 0,
      belowFour: row?.belowFour ?? 0, belowThree: row?.belowThree ?? 0, belowTwo: row?.belowTwo ?? 0,
    };
  };
  const current = summary("current");
  const previous = summary("previous");
  return {
    current, previous,
    changePercent: current.ratedOrders && previous.ratedOrders
      ? compareMetric(current.averageRating, previous.averageRating).changePercent : null,
  };
};

const getQuality = async (period: Period) => {
  const { fromDate, toDate } = period;
  const dateMatch = { isDeleted: false, createdAt: { $gte: fromDate, $lte: toDate } };
  const [ratings, providers, ratingStats] = await Promise.all([
    Feedback.aggregate<{ total: number; lowRatings: number }>([
      { $match: dateMatch },
      { $group: { _id: null, total: { $sum: 1 }, lowRatings: sumWhen({ $lte: ["$rating", 2] }) } },
    ]),
    Complaint.aggregate<{ userId: string; fullName: string; complaintCount: number }>([
      { $match: { ...dateMatch, status: { $nin: ["rejected", "cancelled"] } } },
      { $group: { _id: "$targetUserId", complaintCount: { $sum: 1 } } },
      { $match: { complaintCount: { $gte: 2 } } },
      { $lookup: { from: "providers", localField: "_id", foreignField: "userId", as: "provider" } },
      { $match: { "provider.isDeleted": false } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" }, { $match: { "user.isDeleted": false } },
      { $sort: { complaintCount: -1, _id: 1 } }, { $limit: 5 },
      { $project: { _id: 0, userId: "$_id", fullName: "$user.fullName", complaintCount: 1 } },
    ]),
    getAdminRatingStats(period),
  ]);
  return { totalRatings: ratings[0]?.total ?? 0, lowRatings: ratings[0]?.lowRatings ?? 0, providers, ratingStats };
};

export const getAdminInsights = async (query: AdminDashboardQuery) => {
  const now = new Date();
  const period = getInsightsPeriod(query, now);
  const [pendingWork, attentionOrders, comparison, customers, deposits, quality, monthlyComparison] = await Promise.all([
    getPendingWork(), getAttentionOrders(now), getComparison(period), getCustomers(period), getDeposits(period), getQuality(period),
    getComparison(getMonthlyComparisonPeriod(now)),
  ]);
  return { asOf: now, period, pendingWork, attentionOrders, comparison, customers, deposits, quality, monthlyComparison };
};
