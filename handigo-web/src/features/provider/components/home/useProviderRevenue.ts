import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderEarningPoint,
  type ProviderMonthlyEarningPoint,
} from "../../api/providerDashboard.api";
import {
  dateKey,
  getRevenueChart,
  getRevenueRange,
  revenueWeekKey,
  type RevenueCustomRange,
  type RevenuePeriod,
} from "./providerHome.utils";

/** Doanh thu theo tuần, tháng hoặc năm cho biểu đồ trang chủ nhà cung cấp. */
export function useProviderRevenue() {
  const [revenuePeriod, setRevenuePeriodState] = useState<RevenuePeriod>("week");
  const [revenueWeek, setRevenueWeekState] = useState(() => revenueWeekKey(new Date()));
  const [revenueMonth, setRevenueMonthState] = useState(() => dateKey(new Date()).slice(0, 7));
  const [revenueYear, setRevenueYearState] = useState(new Date().getFullYear());
  const [customRevenueRange, setCustomRevenueRange] = useState<RevenueCustomRange | null>(null);
  const [revenueEarnings, setRevenueEarnings] = useState<
    ProviderEarningPoint[]
  >([]);
  const [monthlyRevenueEarnings, setMonthlyRevenueEarnings] = useState<
    ProviderMonthlyEarningPoint[]
  >([]);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);
  const [earningsError, setEarningsError] = useToastFeedback<string | null>(null, "error");
  const revenueRange = getRevenueRange(
    revenuePeriod,
    revenueYear,
    customRevenueRange,
    revenueWeek,
    revenueMonth,
  );
  const queryStart = dateKey(revenueRange.queryStart);
  const queryEnd = dateKey(revenueRange.queryEnd);

  useEffect(() => {
    let cancelled = false;

    providerDashboardApi
      .earnings(queryStart, queryEnd)
      .then((result) => {
        if (!cancelled) {
          setRevenueEarnings(result.earningsByDay);
          setMonthlyRevenueEarnings(result.earningsByMonth);
          setEarningsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEarningsError("Không thể tải dữ liệu doanh thu.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEarnings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryEnd, queryStart, setEarningsError]);

  const setRevenuePeriod = (period: RevenuePeriod) => {
    if (period === "custom" && !customRevenueRange) return;
    if (period === revenuePeriod) return;
    setRevenuePeriodState(period);
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const setRevenueYear = (year: number) => {
    if (year === revenueYear && revenuePeriod === "year") return;
    setRevenueYearState(year);
    setRevenuePeriodState("year");
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const setRevenueWeek = (week: string) => {
    if (!week) return;
    if (week === revenueWeek && revenuePeriod === "week") return;
    setRevenueWeekState(week);
    setRevenuePeriodState("week");
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const setRevenueMonth = (month: string) => {
    if (!month) return;
    if (month === revenueMonth && revenuePeriod === "month") return;
    setRevenueMonthState(month);
    setRevenuePeriodState("month");
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const applyCustomRevenueRange = (range: RevenueCustomRange) => {
    if (
      revenuePeriod === "custom"
      && range.fromDate === customRevenueRange?.fromDate
      && range.toDate === customRevenueRange?.toDate
    ) return;
    setCustomRevenueRange(range);
    setRevenuePeriodState("custom");
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const earningsByDay = new Map(
    revenueEarnings.map((item) => [item.day, item.amount]),
  );
  const earningsByMonth = new Map(
    monthlyRevenueEarnings.map((item) => [item.month, item.amount]),
  );
  const revenueChart = getRevenueChart(
    revenuePeriod,
    revenueRange.dates,
    earningsByDay,
    earningsByMonth,
  );
  const revenueTotal = revenueChart.reduce(
    (total, item) => total + item.amount,
    0,
  );

  return {
    revenuePeriod,
    setRevenuePeriod,
    revenueWeek,
    setRevenueWeek,
    revenueMonth,
    setRevenueMonth,
    revenueYear,
    setRevenueYear,
    customRevenueRange,
    applyCustomRevenueRange,
    isLoadingEarnings,
    earningsError,
    revenueRange,
    revenueChart,
    revenueTotal,
  };
}
