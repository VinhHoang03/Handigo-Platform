import type { PipelineStage } from "mongoose";
import { FeedbackModeration } from "../models/feedbackModeration.model";
import type { ModerationReportQuery } from "../validations/feedback.validator";

export interface FeedbackModerationReportItem {
  _id: string;
  kind: "comment" | "reply";
  resourceId: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  decision: "allow" | "block" | "review";
  source: "rules" | "ai" | "unavailable" | "unknown";
  reason: string;
  createdAt: Date;
  reviewedAt?: Date;
  needsReview: boolean;
  isCurrent: boolean;
  feedback?: { _id: string; isVisible: boolean; rating: number; updatedAt: Date };
}

const emptySummary = { total: 0, allowed: 0, blocked: 0, savedHidden: 0, hidden: 0,
  needsReview: 0, unavailable: 0, approvedByAdmin: 0, rulesBlocked: 0 };

export async function getFeedbackModerationReport(query: ModerationReportQuery) {
  const end = new Date();
  const start = query.days === "all" ? null : new Date(end.getTime() - Number(query.days) * 86400000);
  const current = { $and: [
    { $ne: [{ $ifNull: ["$feedback._id", null] }, null] },
    { $eq: ["$feedback.isDeleted", false] },
    { $eq: ["$feedback.moderationId", "$_id"] },
  ] };
  const viewFilter = query.view === "attention" ? { needsReview: true }
    : query.view === "blocked" ? { decision: "block" } : {};
  const sumIf = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });
  const pipeline: PipelineStage[] = [
    { $match: { createdAt: { ...(start ? { $gte: start } : {}), $lte: end } } },
    { $lookup: { from: "feedbacks", localField: "feedbackId", foreignField: "_id",
      pipeline: [{ $project: { isVisible: 1, isDeleted: 1, moderationId: 1, rating: 1, updatedAt: 1 } }], as: "feedback" } },
    { $set: { feedback: { $arrayElemAt: ["$feedback", 0] },
      decision: { $ifNull: ["$decision", "review"] }, source: { $ifNull: ["$source", "unknown"] } } },
    { $set: { isCurrent: current } },
    { $set: { needsReview: { $and: [ { $eq: ["$status", "pending"] },
      { $or: [ { $eq: [{ $ifNull: ["$feedbackId", null] }, null] },
        { $and: ["$isCurrent", { $eq: ["$feedback.isVisible", false] }] } ] },
    ] } } },
    { $facet: {
      summary: [{ $group: { _id: null, total: { $sum: 1 },
        allowed: sumIf({ $eq: ["$decision", "allow"] }),
        blocked: sumIf({ $eq: ["$decision", "block"] }),
        savedHidden: sumIf({ $and: [{ $eq: ["$decision", "review"] }, { $ne: [{ $ifNull: ["$feedbackId", null] }, null] }] }),
        hidden: sumIf({ $and: ["$isCurrent", { $eq: ["$decision", "review"] }, { $eq: ["$feedback.isVisible", false] }] }),
        needsReview: sumIf("$needsReview"),
        unavailable: sumIf({ $eq: ["$source", "unavailable"] }),
        approvedByAdmin: sumIf({ $and: [{ $eq: ["$status", "approved"] }, { $ne: [{ $ifNull: ["$reviewedBy", null] }, null] }] }),
        rulesBlocked: sumIf({ $and: [{ $eq: ["$decision", "block"] }, { $eq: ["$source", "rules"] }] }),
      } }, { $project: { _id: 0 } }],
      items: [{ $match: viewFilter }, { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (query.page - 1) * query.limit }, { $limit: query.limit },
        { $project: { kind: 1, resourceId: 1, content: 1, status: 1, decision: 1, source: 1, reason: 1,
          createdAt: 1, reviewedAt: 1, needsReview: 1, isCurrent: 1,
          "feedback._id": 1, "feedback.isVisible": 1, "feedback.rating": 1, "feedback.updatedAt": 1 } }],
      count: [{ $match: viewFilter }, { $count: "total" }],
    } },
  ];
  const [result] = await FeedbackModeration.aggregate<{
    summary: Array<typeof emptySummary>; items: FeedbackModerationReportItem[]; count: Array<{ total: number }>;
  }>(pipeline);
  const total = result?.count[0]?.total ?? 0;
  return { period: { start, end, days: query.days }, summary: result?.summary[0] ?? { ...emptySummary },
    items: result?.items ?? [], pagination: { page: query.page, limit: query.limit, total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
}
