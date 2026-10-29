import { AppError } from "../utils/appError";
import type { AdminDashboardQuery } from "../validations/adminDashboard.validator";

const DAY_MS = 86_400_000;

export const getInsightsPeriod = (query: AdminDashboardQuery, now = new Date()) => {
  const today = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  const [year, month] = today.split('-').map(Number);
  const toDate = query.toDate ?? (query.fromDate
    ? new Date(`${today}T23:59:59.999+07:00`)
    : new Date(Date.UTC(year, month, 1) - 7 * 3_600_000 - 1));
  const fromDate = query.fromDate ?? (query.toDate
    ? new Date(toDate.getTime() + 1 - 30 * DAY_MS)
    : new Date(Date.UTC(year, month - 1, 1) - 7 * 3_600_000));
  if (fromDate > toDate) throw new AppError("Ngày bắt đầu không được lớn hơn ngày kết thúc", 400);
  const duration = toDate.getTime() - fromDate.getTime() + 1;
  const localStart = new Date(fromDate.getTime() + 7 * 3_600_000);
  const startOfMonth = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), 1) - 7 * 3_600_000;
  const endOfMonth = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth() + 1, 1) - 7 * 3_600_000 - 1;
  const fullMonth = fromDate.getTime() === startOfMonth && toDate.getTime() === endOfMonth;
  return {
    fromDate, toDate,
    previousFromDate: new Date(fullMonth
      ? Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth() - 1, 1) - 7 * 3_600_000
      : fromDate.getTime() - duration),
    previousToDate: new Date(fromDate.getTime() - 1),
  };
};

export const compareMetric = (current: number, previous: number) => ({
  current, previous,
  // Không biểu diễn phần trăm vô hạn khi kỳ trước chưa có dữ liệu.
  changePercent: previous === 0 ? null : (current - previous) / previous * 100,
});

export const getMonthlyComparisonPeriod = (now = new Date()) => {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const fromDate = new Date(Date.UTC(year, month, 1) - 7 * 3_600_000);
  return {
    fromDate,
    toDate: now,
    previousFromDate: new Date(Date.UTC(year, month - 1, 1) - 7 * 3_600_000),
    previousToDate: new Date(fromDate.getTime() - 1),
  };
};

export const orderAttentionConditions = (now: Date) => ({
  awaitingProvider: { status: "created" as const, readyForMatching: true, providerId: null },
  lateArrival: { status: "accepted" as const, $or: [
    { "schedule.expectedStartAt": { $type: "date" as const, $lt: now } },
    { "schedule.expectedStartAt": null, scheduledAt: { $type: "date" as const, $lt: now } },
  ] },
  overdue: { status: "in_progress" as const, $or: [
    { "schedule.expectedEndAt": { $type: "date" as const, $lt: now } },
    { "overdueReview.escalatedAt": { $type: "date" as const } },
  ] },
});
