import type { PipelineStage } from "mongoose";
import { WalletTransaction, type IWalletTransaction } from "../models/walletTransaction.model";
import type { WalletTransactionQuery } from "../validations/wallet.validator";

type HistoryItem = IWalletTransaction & {
  settlementDetails?: { grossAmount: number; platformFee: number; netEarning: number };
};

/** Gộp cách hiển thị quyết toán trước phân trang; giữ nguyên các bản ghi kế toán. */
export async function getGroupedWalletTransactionHistory(filter: Record<string, unknown>, query: WalletTransactionQuery) {
  const numberOrInvalid = (field: string) => ({ $cond: [{ $isNumber: field }, field, -1] });
  const pipeline: PipelineStage[] = [
    { $match: filter },
    { $set: {
      _gross: numberOrInvalid("$metadata.grossAmount"),
      _fee: numberOrInvalid("$metadata.platformFee"),
      _net: numberOrInvalid("$metadata.netEarning"),
    } },
    { $set: { _eligible: { $and: [
      { $in: ["$type", ["provider_earning", "platform_fee"]] },
      { $eq: ["$status", "success"] },
      { $ne: [{ $ifNull: ["$relatedOrderId", null] }, null] },
      { $in: ["$metadata.paymentMethod", ["bank", "wallet"]] },
      { $eq: ["$metadata.affectsWalletBalance", true] },
      { $ne: ["$metadata.systemRevenueOnly", true] },
      { $gt: ["$_fee", 0] }, { $gte: ["$_net", 0] },
      { $eq: ["$_gross", { $add: ["$_fee", "$_net"] }] },
      { $eq: ["$amount", { $cond: [{ $eq: ["$type", "provider_earning"] }, "$_gross", "$_fee"] }] },
      { $eq: ["$direction", { $cond: [{ $eq: ["$type", "provider_earning"] }, "in", "out"] }] },
    ] } } },
    { $lookup: {
      from: WalletTransaction.collection.name,
      let: {
        eligible: "$_eligible", orderId: "$relatedOrderId", walletId: "$walletId", userId: "$userId",
        gross: "$_gross", fee: "$_fee", net: "$_net", method: "$metadata.paymentMethod",
        earningBalance: { $cond: [{ $eq: ["$type", "provider_earning"] }, "$balanceAfter", { $add: ["$balanceAfter", "$_fee"] }] },
      },
      pipeline: [
        { $match: { status: "success", isDeleted: false, $expr: { $and: [
          { $eq: ["$$eligible", true] },
          { $eq: ["$relatedOrderId", "$$orderId"] },
          { $eq: ["$walletId", "$$walletId"] }, { $eq: ["$userId", "$$userId"] },
          { $in: ["$type", ["provider_earning", "platform_fee"]] },
          { $eq: ["$direction", { $cond: [{ $eq: ["$type", "provider_earning"] }, "in", "out"] }] },
          { $eq: ["$amount", { $cond: [{ $eq: ["$type", "provider_earning"] }, "$$gross", "$$fee"] }] },
          { $eq: ["$balanceAfter", { $cond: [{ $eq: ["$type", "provider_earning"] }, "$$earningBalance", { $subtract: ["$$earningBalance", "$$fee"] }] }] },
          { $eq: ["$metadata.grossAmount", "$$gross"] }, { $eq: ["$metadata.platformFee", "$$fee"] },
          { $eq: ["$metadata.netEarning", "$$net"] }, { $eq: ["$metadata.paymentMethod", "$$method"] },
          { $eq: ["$metadata.affectsWalletBalance", true] }, { $ne: ["$metadata.systemRevenueOnly", true] },
        ] } } },
        { $limit: 3 },
        { $project: { _id: 1, type: 1 } },
      ],
      as: "_paired",
    } },
    { $set: { _grouped: { $and: [
      "$_eligible", { $eq: [{ $size: "$_paired" }, 2] },
      { $setEquals: [{ $map: { input: "$_paired", as: "pair", in: "$$pair.type" } }, ["provider_earning", "platform_fee"]] },
    ] } } },
    { $match: { $or: [{ type: { $ne: "platform_fee" } }, { _grouped: false }] } },
    { $set: {
      amount: { $cond: ["$_grouped", "$_net", "$amount"] },
      balanceAfter: { $cond: ["$_grouped", { $subtract: ["$balanceAfter", "$_fee"] }, "$balanceAfter"] },
      description: { $cond: ["$_grouped", {
        $cond: ["$metadata.orderCode", { $concat: ["Quyết toán đơn ", "$metadata.orderCode"] }, "Đã khấu trừ phí nền tảng trước khi cộng thu nhập."],
      }, "$description"] },
      settlementDetails: { $cond: ["$_grouped", { grossAmount: "$_gross", platformFee: "$_fee", netEarning: "$_net" }, "$$REMOVE"] },
    } },
    { $unset: ["_gross", "_fee", "_net", "_eligible", "_paired", "_grouped"] },
    { $facet: {
      items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
      count: [{ $count: "total" }],
    } },
  ];
  const [result] = await WalletTransaction.aggregate<{ items: HistoryItem[]; count: { total: number }[] }>(pipeline);
  const total = result?.count[0]?.total ?? 0;
  return {
    items: result?.items ?? [],
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}
