import { currentDashboardMonth } from "../dashboard/dashboard-period";
import type { RevenueQuery } from "../../types/adminRevenue.types";

const validDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);

export function revenueRangeFromSearch(search: string): RevenueQuery {
  const params = new URLSearchParams(search);
  const fromDate = params.get("fromDate");
  const toDate = params.get("toDate");
  return validDate(fromDate) && validDate(toDate) && fromDate <= toDate
    ? { fromDate, toDate } : currentDashboardMonth();
}

export function previousRevenueRange(range: RevenueQuery): RevenueQuery & { monthly: boolean } {
  const start = new Date(`${range.fromDate}T00:00:00Z`);
  const end = new Date(`${range.toDate}T00:00:00Z`);
  const nextMonth = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  const monthly = start.getUTCDate() === 1 && end.getTime() + 86_400_000 === nextMonth;
  return {
    fromDate: new Date(monthly ? Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)
      : start.getTime() - (end.getTime() - start.getTime() + 86_400_000)).toISOString().slice(0, 10),
    toDate: new Date(start.getTime() - 86_400_000).toISOString().slice(0, 10),
    monthly,
  };
}
