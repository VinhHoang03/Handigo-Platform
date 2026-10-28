import { AppError } from "../utils/appError";
import type { AdminDashboardQuery } from "../validations/adminDashboard.validator";

const DAY_MS = 86_400_000;

export const getInsightsPeriod = (query: AdminDashboardQuery, now = new Date()) => {
  const today = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  const toDate = query.toDate ?? new Date(`${today}T23:59:59.999+07:00`);
  const fromDate = query.fromDate ?? new Date(toDate.getTime() + 1 - 30 * DAY_MS);
  if (fromDate > toDate) throw new AppError("Ngày bắt đầu không được lớn hơn ngày kết thúc", 400);
  const duration = toDate.getTime() - fromDate.getTime() + 1;
  return {
    fromDate, toDate,
    previousFromDate: new Date(fromDate.getTime() - duration),
    previousToDate: new Date(fromDate.getTime() - 1),
  };
};

export const compareMetric = (current: number, previous: number) => ({
  current, previous,
  // Không biểu diễn phần trăm vô hạn khi kỳ trước chưa có dữ liệu.
  changePercent: previous === 0 ? null : (current - previous) / previous * 100,
});

export const orderAttentionConditions = (now: Date) => ({
  awaitingProvider: { status: "created", readyForMatching: true, providerId: null },
  lateArrival: { status: "accepted", $or: [
    { "schedule.expectedStartAt": { $type: "date", $lt: now } },
    { "schedule.expectedStartAt": null, scheduledAt: { $type: "date", $lt: now } },
  ] },
  overdue: { status: "in_progress", $or: [
    { "schedule.expectedEndAt": { $type: "date", $lt: now } },
    { "overdueReview.escalatedAt": { $type: "date" } },
  ] },
});
