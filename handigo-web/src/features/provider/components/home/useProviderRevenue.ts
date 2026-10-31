import { useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderEarningPoint,
} from "../../api/providerDashboard.api";
import {
  dateKey,
  getRevenueChart,
  getRevenueRange,
  getRevenueToday,
  type RevenuePeriod,
} from "./providerHome.utils";

/** Doanh thu theo kỳ đã chọn, không hiển thị dữ liệu của kỳ trước khi đang tải. */
export function useProviderRevenue() {
  const [revenuePeriod, setRevenuePeriodState] = useState<RevenuePeriod>("week");
  const [revenueAnchor, setRevenueAnchor] = useState(getRevenueToday);
  const [result, setResult] = useState<{ key: string; earnings: ProviderEarningPoint[]; error: string | null } | null>(null);
  const revenueRange = getRevenueRange(revenuePeriod, revenueAnchor);
  const fromDate = dateKey(revenueRange.dates[0]);
  const toDate = dateKey(revenueRange.dates[revenueRange.dates.length - 1]);
  const key = `${fromDate}/${toDate}`;

  useEffect(() => {
    let cancelled = false;

    providerDashboardApi
      .earnings(
        fromDate,
        toDate,
      )
      .then((result) => {
        if (!cancelled) {
          setResult({ key, earnings: result.earningsByDay, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key, earnings: [], error: "Không thể tải dữ liệu doanh thu." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, key]);

  const setRevenuePeriod = (period: RevenuePeriod) => {
    setRevenuePeriodState(period);
  };

  const current = result?.key === key ? result : null;
  const earningsByDay = new Map(
    (current?.earnings ?? []).map((item) => [item.day, item.amount]),
  );
  const revenueChart = getRevenueChart(revenuePeriod, revenueRange.dates, earningsByDay);
  const revenueTotal = revenueChart.reduce(
    (total, item) => total + item.amount,
    0,
  );

  return {
    revenuePeriod,
    setRevenuePeriod,
    revenueAnchor,
    setRevenueAnchor,
    isLoadingEarnings: !current,
    earningsError: current?.error ?? null,
    revenueRange,
    revenueChart,
    revenueTotal,
  };
}
