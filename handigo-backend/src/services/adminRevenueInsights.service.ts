import type { PipelineStage } from "mongoose";
import { Payment } from "../models/payment.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Report } from "../models/report.model";
import type { AdminDashboardQuery } from "../validations/adminDashboard.validator";
import { compareMetric, getInsightsPeriod } from "./adminDashboardMetrics";

interface ServiceRevenue {
  serviceId: string | null; name: string; categoryName: string;
  revenue: number; completedOrders: number;
}
interface ChannelAmount { method: string; amount: number; count: number }

const serviceRevenue = (fromDate: Date, toDate: Date) => WalletTransaction.aggregate<ServiceRevenue>([
  { $match: { isDeleted: false, status: "success", type: "provider_earning", direction: "in",
    "metadata.netEarning": { $exists: true }, createdAt: { $gte: fromDate, $lte: toDate } } },
  { $lookup: { from: "orders", localField: "relatedOrderId", foreignField: "_id", as: "order" } },
  { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
  { $group: { _id: { $ifNull: ["$order.serviceId", null] }, revenue: { $sum: { $ifNull: ["$metadata.grossAmount", "$amount"] } }, orderIds: { $addToSet: "$relatedOrderId" } } },
  { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
  { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "categories", localField: "service.categoryId", foreignField: "_id", as: "category" } },
  { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  { $sort: { revenue: -1, _id: 1 } },
  { $project: { _id: 0, serviceId: "$_id", name: { $ifNull: ["$service.name", "Dịch vụ không còn thông tin"] },
    categoryName: { $ifNull: ["$category.name", "Chưa phân loại"] }, revenue: 1,
    completedOrders: { $size: { $setDifference: ["$orderIds", [null]] } } } },
]);

const channelAmounts = (fromDate: Date, toDate: Date, refunded: boolean) => Payment.aggregate<ChannelAmount>([
  { $match: { isDeleted: false, status: refunded ? "refunded" : { $in: ["paid", "refunded"] },
    [refunded ? "refundedAt" : "paidAt"]: { $gte: fromDate, $lte: toDate } } },
  { $group: { _id: "$method", amount: { $sum: refunded ? { $ifNull: ["$metadata.refund.amount", "$amount"] } : "$amount" }, count: { $sum: 1 } } },
  { $project: { _id: 0, method: "$_id", amount: 1, count: 1 } },
]);

export const BEHAVIOR_REPORT_TYPES = ["harassment", "insulting_language", "user_behavior", "fraud", "impersonation", "sabotage"];

const behaviorPipeline = (fromDate: Date, toDate: Date): PipelineStage[] => [
  { $match: { isDeleted: false, targetUserId: { $ne: null }, reportType: { $in: BEHAVIOR_REPORT_TYPES },
    status: { $in: ["pending", "under_review", "confirmed"] }, createdAt: { $gte: fromDate, $lte: toDate } } },
  { $sort: { createdAt: -1, _id: -1 } },
  { $group: { _id: "$targetUserId", reports: { $sum: 1 }, confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
    latestReportId: { $first: "$_id" }, latestTitle: { $first: "$title" }, latestAt: { $first: "$createdAt" } } },
  { $lookup: { from: "providers", localField: "_id", foreignField: "userId", as: "provider" } },
  { $match: { "provider.isDeleted": false } },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },
  { $match: { "user.isDeleted": false } },
  { $sort: { confirmed: -1, reports: -1, latestAt: -1, _id: 1 } },
  { $project: { _id: 0, userId: "$_id", fullName: "$user.fullName", reports: 1, confirmed: 1, latestReportId: 1, latestTitle: 1, latestAt: 1 } },
  { $facet: { items: [{ $limit: 5 }], total: [{ $count: "count" }] } },
];

export const getAdminRevenueInsights = async (query: AdminDashboardQuery) => {
  const period = getInsightsPeriod(query);
  const { fromDate, toDate, previousFromDate, previousToDate } = period;
  const [services, previousServices, collected, refunded, risks] = await Promise.all([
    serviceRevenue(fromDate, toDate), serviceRevenue(previousFromDate, previousToDate),
    channelAmounts(fromDate, toDate, false), channelAmounts(fromDate, toDate, true),
    Report.aggregate<{ items: Array<{ userId: string; fullName: string; reports: number; confirmed: number; latestReportId: string; latestTitle: string; latestAt: Date }>; total: Array<{ count: number }> }>(behaviorPipeline(fromDate, toDate)),
  ]);
  const previousByService = new Map(previousServices.map(item => [String(item.serviceId), item.revenue]));
  // Giữ dịch vụ chỉ có doanh thu tháng trước để thể hiện cả mức giảm về 0.
  const currentIds = new Set(services.map(item => String(item.serviceId)));
  const rows = [...services, ...previousServices.filter(item => !currentIds.has(String(item.serviceId)))
    .map(item => ({ ...item, revenue: 0, completedOrders: 0 }))];
  const totalRevenue = services.reduce((sum, item) => sum + item.revenue, 0);
  const totalCollected = collected.reduce((sum, item) => sum + item.amount, 0);
  const methods = [...new Set(["wallet", "payos", "cash", ...collected.map(item => item.method), ...refunded.map(item => item.method)])];
  return {
    period, totalServiceRevenue: totalRevenue,
    services: rows.map(item => ({ ...item, ...compareMetric(item.revenue, previousByService.get(String(item.serviceId)) ?? 0),
      share: totalRevenue ? item.revenue / totalRevenue * 100 : 0 })),
    topServices: [...services].sort((a, b) => b.completedOrders - a.completedOrders || b.revenue - a.revenue).slice(0, 5),
    channels: methods.map(method => {
      const paid = collected.find(item => item.method === method);
      const returned = refunded.find(item => item.method === method);
      return { method, collected: paid?.amount ?? 0, refunded: returned?.amount ?? 0,
        net: (paid?.amount ?? 0) - (returned?.amount ?? 0), count: paid?.count ?? 0,
        share: totalCollected ? (paid?.amount ?? 0) / totalCollected * 100 : 0 };
    }),
    behaviorRisks: { items: risks[0]?.items ?? [], total: risks[0]?.total[0]?.count ?? 0 },
  };
};
