import { useProviderOrdersSchedule } from "./useProviderOrdersSchedule";
import { useProviderRevenue } from "./useProviderRevenue";
import { useProviderRating } from "./useProviderRating";
import { useEffect, useState } from "react";
import { useToastFeedback } from "@/components/common/Toast";
import { providerDashboardApi } from "../../api/providerDashboard.api";

/**
 * Gộp state + effect tải dữ liệu cho trang chủ thợ. Tách khỏi component để
 * `ProviderHomePage.tsx` chỉ còn phần bố cục; mỗi mảng dữ liệu (đơn/lịch,
 * doanh thu, đánh giá) sống trong hook riêng để dễ đọc và test độc lập.
 */
export function useProviderHomeData() {
  const ordersSchedule = useProviderOrdersSchedule();
  const revenue = useProviderRevenue();
  const rating = useProviderRating();

  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [isLoadingIncome, setIsLoadingIncome] = useState(true);
  const [incomeError, setIncomeError] = useToastFeedback<string | null>(null, "error");

  useEffect(() => {
    let cancelled = false;
    providerDashboardApi.overview().then((overview) => {
      if (!cancelled) setMonthlyIncome(overview.monthlyEarnings);
    }).catch(() => {
      if (!cancelled) setIncomeError("Không thể tải thu nhập tháng này.");
    }).finally(() => {
      if (!cancelled) setIsLoadingIncome(false);
    });
    return () => { cancelled = true; };
  }, [setIncomeError]);

  return {
    ...ordersSchedule,
    ...revenue,
    ...rating,
    monthlyIncome,
    isLoadingIncome,
    incomeError,
  };
}
