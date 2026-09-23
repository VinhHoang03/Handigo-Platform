import { useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderEarningPoint,
} from "../../api/providerDashboard.api";
import {
  dateKey,
  getRevenueRange,
  type RevenuePeriod,
} from "./providerHome.utils";

/** Doanh thu theo tuần/tháng cho biểu đồ trang chủ thợ. */
export function useProviderRevenue() {
  const [revenuePeriod, setRevenuePeriodState] = useState<RevenuePeriod>("week");
  const [revenueEarnings, setRevenueEarnings] = useState<
    ProviderEarningPoint[]
  >([]);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const range = getRevenueRange(revenuePeriod);

    providerDashboardApi
      .earnings(
        dateKey(range.dates[0]),
        dateKey(range.dates[range.dates.length - 1]),
      )
      .then((result) => {
        if (!cancelled) {
          setRevenueEarnings(result.earningsByDay);
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
  }, [revenuePeriod]);

  const setRevenuePeriod = (period: RevenuePeriod) => {
    setRevenuePeriodState(period);
    setIsLoadingEarnings(true);
    setEarningsError(null);
  };

  const revenueRange = getRevenueRange(revenuePeriod);
  const earningsByDay = new Map(
    revenueEarnings.map((item) => [item.day, item.amount]),
  );
  const revenueChart = revenueRange.dates.map((date) => ({
    key: dateKey(date),
    label:
      revenuePeriod === "week"
        ? date.toLocaleDateString("vi-VN", { weekday: "short" })
        : String(date.getDate()),
    amount: earningsByDay.get(dateKey(date)) ?? 0,
  }));
  const revenueTotal = revenueChart.reduce(
    (total, item) => total + item.amount,
    0,
  );

  return {
    revenuePeriod,
    setRevenuePeriod,
    isLoadingEarnings,
    earningsError,
    revenueRange,
    revenueChart,
    revenueTotal,
  };
}
