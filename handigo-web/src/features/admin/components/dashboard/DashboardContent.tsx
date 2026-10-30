import { memo } from "react";
import { ReducedChartMotionContext } from "@/components/common/chart/use-prefers-reduced-motion";
import type { AdminOrderAnalytics, AdminProviderAnalytics } from "../../types/adminOperations.types";
import type { RevenueQuery } from "../../types/adminRevenue.types";
import { previousRevenueRange } from "../revenue/revenue-period";
import { DashboardRevenueSection } from "../revenue/DashboardRevenueSection";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardInsights } from "./DashboardInsights";
import { DashboardMetricGrid } from "./DashboardMetricGrid";

export interface DashboardSnapshot {
  range: RevenueQuery;
  orders: AdminOrderAnalytics;
  providers: AdminProviderAnalytics;
}

/** Giữ nguyên cây biểu đồ khi người dùng còn đang đổi bộ lọc ở thanh công cụ. */
export const DashboardContent = memo(function DashboardContent({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { range, orders, providers } = snapshot;
  const monthly = previousRevenueRange(range).monthly;
  return <ReducedChartMotionContext.Provider value={true}>
    <DashboardInsights fromDate={range.fromDate} toDate={range.toDate} summary={insights => <DashboardMetricGrid
      monthly={monthly}
      periodComparison={insights?.comparison}
      ratingStats={insights?.quality.ratingStats}
      previousPeriodLabel={insights ? `${new Date(insights.period.previousFromDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – ${new Date(insights.period.previousToDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : undefined}
      periodLabel={insights ? `${new Date(insights.period.fromDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – ${new Date(insights.period.toDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Đang tải kỳ thống kê'}
      providers={providers}
    />} />
    <DashboardCharts orders={orders} query={{ ...range, topLimit: 5 }} />
    <DashboardRevenueSection range={range} providers={providers} />
  </ReducedChartMotionContext.Provider>;
});
