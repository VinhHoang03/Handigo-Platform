import mongoose, { type ClientSession, type Types } from "mongoose";
import { Feedback } from "../models/feedback.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { Provider } from "../models/provider.model";
import { ProviderRewardWeek } from "../models/providerRewardWeek.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { withTransactionRetry } from "../utils/transaction";
import { creditProviderWeeklyReward } from "./wallet.service";
import {
  parseRewardWeek, providerOrderDiamonds, providerRewardMilestones, providerRewardWeek,
  rewardWeekKey, rewardWeekMs, summarizeProviderRewards,
} from "./providerRewardsPolicy";

const logger = createLogger("ProviderRewards");
const configuredStart = () => parseRewardWeek(process.env.PROVIDER_REWARDS_START_WEEK ?? "");
const weekId = (providerId: Types.ObjectId, start: Date) => `${providerId}:${rewardWeekKey(start)}`;

async function calculateWeek(providerId: Types.ObjectId, start: Date, session: ClientSession | null = null) {
  const end = new Date(start.getTime() + rewardWeekMs);
  const inWeek = { $gte: start, $lt: end };
  const scope = { providerId, isDeleted: false };
  const completionDate = "confirmation.providerConfirmedAt";
  const completed = await Order.countDocuments({
    ...scope, status: "completed", [completionDate]: inWeek,
  }).session(session);
  const cancelled = await Order.countDocuments({
    ...scope, status: "cancelled", "cancellation.cancelledByRole": "provider",
    "cancellation.cancelledAt": inWeek,
  }).session(session);
  const [rating] = await Feedback.aggregate<{ total: number; count: number }>([
    { $match: { ...scope, createdAt: inWeek } },
    { $group: { _id: null, total: { $sum: "$rating" }, count: { $sum: 1 } } },
  ]).session(session);

  // Cả đơn tiền mặt và đơn báo giá có thể được thanh toán sau khi hoàn thành.
  const diamondOrders = await Order.aggregate<{ _id: Types.ObjectId; inspectionRequired: boolean; amount: number }>([
    { $match: { ...scope, status: "completed", paymentStatus: "paid",
      $or: [
        { [completionDate]: inWeek },
        { paymentMethod: "cash", [completionDate]: { $lt: start } },
        { inspectionRequired: true, [completionDate]: { $lt: start } },
      ],
    } },
    { $lookup: {
      from: Payment.collection.name,
      localField: "_id",
      foreignField: "orderId",
      pipeline: [
        { $match: { isDeleted: false, paymentType: { $in: ["full", "remaining"] }, status: "paid", paidAt: { $type: "date" } } },
        { $project: { _id: 0, paidAt: 1, paymentType: 1, metadata: 1 } },
      ],
      as: "payments",
    } },
    { $lookup: {
      from: RepairQuotation.collection.name,
      localField: "currentQuotationId",
      foreignField: "_id",
      pipeline: [
        { $match: { isDeleted: false } },
        { $project: { directPaymentConfirmedAt: 1, revision: 1 } },
      ],
      as: "quotation",
    } },
    { $set: { quotation: { $arrayElemAt: ["$quotation", 0] } } },
    { $set: { paidAt: { $cond: ["$inspectionRequired",
      { $ifNull: ["$quotation.directPaymentConfirmedAt", { $max: { $map: {
        input: { $filter: { input: "$payments", as: "payment", cond: { $and: [
          { $eq: ["$$payment.paymentType", "remaining"] },
          { $eq: ["$$payment.metadata.quotationId", { $toString: "$quotation._id" }] },
          { $eq: ["$$payment.metadata.quotationRevision", { $ifNull: ["$quotation.revision", 0] }] },
        ] } } },
        as: "payment", in: "$$payment.paidAt",
      } } }] },
      { $max: { $map: {
        input: { $filter: { input: "$payments", as: "payment", cond: { $eq: ["$$payment.paymentType", "full"] } } },
        as: "payment", in: "$$payment.paidAt",
      } } },
    ] } } },
    { $match: { $or: [
      { paidAt: { $type: "date" } },
      // Đơn giá cố định điện tử chỉ được hoàn thành sau khi đã thanh toán.
      { inspectionRequired: { $ne: true }, paymentMethod: { $ne: "cash" } },
    ] } },
    { $set: { qualifiedAt: { $max: [`$${completionDate}`, "$paidAt"] } } },
    { $match: { qualifiedAt: inWeek } },
    { $project: { inspectionRequired: 1, amount: { $ifNull: ["$pricing.bookingAmount", "$pricing.totalPaidAmount"] } } },
  ]).session(session);
  const diamonds = diamondOrders.reduce((sum, order) =>
    sum + providerOrderDiamonds(order.inspectionRequired, order.amount), 0);
  return summarizeProviderRewards(diamonds, completed, cancelled, rating?.total ?? 0, rating?.count ?? 0);
}

async function providerFor(userId: string) {
  const provider = await Provider.findOne({ userId, verified: true, isDeleted: false }).select("_id").lean();
  if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ đã được duyệt.", 403);
  return provider._id;
}

export async function getProviderRewardOverview(userId: string, requestedWeek?: string) {
  const providerId = await providerFor(userId);
  const current = providerRewardWeek(new Date());
  const start = requestedWeek ? parseRewardWeek(requestedWeek) : current;
  if (!start || start > current) throw new AppError("Tuần thưởng không hợp lệ.", 400);
  const activation = configuredStart();
  const programActive = !!activation && start >= activation;
  const settled = await ProviderRewardWeek.findById(weekId(providerId, start)).lean();
  const status = settled ? "settled" : start.getTime() === current.getTime()
    ? "open" : programActive ? "pending" : "inactive";
  return {
    weekStart: rewardWeekKey(start), status, programActive,
    milestones: settled?.milestones ?? providerRewardMilestones,
    summary: settled?.summary ?? (status === "inactive" ? null : await calculateWeek(providerId, start)),
  };
}

export async function listProviderRewardWeeks(userId: string, before?: string) {
  const providerId = await providerFor(userId);
  const boundary = before ? parseRewardWeek(before) : null;
  if (before && !boundary) throw new AppError("Tuần thưởng không hợp lệ.", 400);
  const rows = await ProviderRewardWeek.find({
    providerId, ...(boundary ? { weekStart: { $lt: boundary } } : {}),
  }).sort({ weekStart: -1 }).limit(21).lean();
  const items = rows.slice(0, 20).map((row) => ({
    weekStart: rewardWeekKey(row.weekStart), settledAt: row.settledAt, summary: row.summary,
  }));
  return { items, nextBefore: rows.length > 20 ? items[19].weekStart : null };
}

async function settleWeek(providerId: Types.ObjectId, userId: Types.ObjectId, start: Date) {
  const id = weekId(providerId, start);
  const session = await mongoose.startSession();
  try {
    await withTransactionRetry(session, async () => {
      if (await ProviderRewardWeek.exists({ _id: id }).session(session)) return;
      const summary = await calculateWeek(providerId, start, session);
      await ProviderRewardWeek.create([{
        _id: id, providerId, weekStart: start, summary, settledAt: new Date(),
        milestones: [...providerRewardMilestones],
      }], { session });
      if (summary.amount > 0) await creditProviderWeeklyReward(userId, summary.amount, rewardWeekKey(start), session);
    });
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000 || !await ProviderRewardWeek.exists({ _id: id })) throw error;
  } finally {
    await session.endSession();
  }
}

let timer: NodeJS.Timeout | undefined;
let running: Promise<void> | undefined;

export function startProviderRewardsMonitor() {
  const activation = configuredStart();
  if (timer || !activation) {
    if (!activation && process.env.PROVIDER_REWARDS_START_WEEK) logger.warn("Ngày bắt đầu thưởng tuần phải là thứ Hai hợp lệ.");
    return;
  }
  const tick = () => {
    if (running) return;
    running = (async () => {
      const current = providerRewardWeek(new Date());
      if (activation >= current) return;
      const providers = Provider.find({ verified: true, isDeleted: false }).select("_id userId createdAt").lean().cursor();
      for await (const provider of providers) {
        const first = providerRewardWeek(provider.createdAt);
        const start = first > activation ? first : activation;
        const last = await ProviderRewardWeek.findOne({ providerId: provider._id }).sort({ weekStart: -1 }).select("weekStart").lean();
        const next = last ? Math.max(start.getTime(), last.weekStart.getTime() + rewardWeekMs) : start.getTime();
        try {
          for (let week = next; timer && week < current.getTime(); week += rewardWeekMs) {
            await settleWeek(provider._id, provider.userId, new Date(week));
          }
        } catch (error) {
          logger.error("Chưa chốt được thưởng tuần cho thợ.", error, { providerId: String(provider._id) });
        }
        if (!timer) break;
      }
    })().catch((error: unknown) => logger.error("Lỗi khi quét thưởng tuần.", error))
      .finally(() => { running = undefined; });
  };
  timer = setInterval(tick, 60_000);
  timer.unref();
  tick();
}

export async function stopProviderRewardsMonitor() {
  clearInterval(timer);
  timer = undefined;
  await running;
}
