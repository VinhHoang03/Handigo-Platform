import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { previousRevenueRange, revenueRangeFromSearch } from "../components/revenue/revenue-period";
import { RevenueRangeFilter } from "../components/revenue/RevenueRangeFilter";
import { DashboardRevenueSection } from "../components/revenue/DashboardRevenueSection";
import { createRange } from "../components/revenue/revenue-format";
import type { RevenueQuery } from "../types/adminRevenue.types";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { DashboardMetricGrid } from "../components/dashboard/DashboardMetricGrid";
import { DashboardInsights } from "../components/dashboard/DashboardInsights";
import { currentDashboardMonth } from "../components/dashboard/dashboard-period";
import "../components/dashboard/dashboard-operations.css";
import type {
  AdminOrderAnalytics,
  AdminProviderAnalytics,
} from "../types/adminOperations.types";

export default function AdminDashboardPage() {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => revenueRangeFromSearch(params.toString()), [params]);
  const { fromDate: effectiveFromDate, toDate: effectiveToDate } = range;
  const setRange = (next: RevenueQuery) => setParams((previous) => {
    const nextParams = new URLSearchParams(previous);
    nextParams.set("fromDate", next.fromDate);
    nextParams.set("toDate", next.toDate);
    return nextParams;
  }, { replace: true });
  const monthly = previousRevenueRange(range).monthly;
  const requestRef = useRef(0);
  const [orders, setOrders] = useState<AdminOrderAnalytics | null>(null);
  const [providers, setProviders] = useState<AdminProviderAnalytics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      setLoading(true);
      setError("");
      const query = {
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
        topLimit: 5,
      };
      const [orderData, providerData] = await Promise.all([
        adminOperationsApi.orderAnalytics(query),
        adminOperationsApi.providerAnalytics(query),
      ]);
      if (requestId === requestRef.current) { setOrders(orderData); setProviders(providerData); }
    } catch (requestError) {
      if (requestId === requestRef.current) setError(
        getErrorMessage(requestError, "Không thể tải tổng quan quản trị."),
      );
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [effectiveFromDate, setError, effectiveToDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => { requestRef.current += 1; window.clearTimeout(timeoutId); };
  }, [load]);

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header admin-revenue-header admin-overview-header">
        <div>
          <AdminPageTitle title="Tổng quan quản trị" />
        </div>
        <div className="admin-header-actions justify-end">
        <button type="button" onClick={() => setRange(currentDashboardMonth())} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold">Tháng này</button>
        <RevenueRangeFilter range={range} onPreset={(days) => setRange(createRange(days))} onChange={setRange} />
        <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
        </div>
      </header>

      <AsyncState
        loading={loading}
        error={error}
        empty={!orders || !providers}
        emptyMessage="Chưa có dữ liệu tổng quan."
        onRetry={load}
      >
        {orders && providers && (
          <>
            <DashboardInsights key={`insights:${effectiveFromDate}:${effectiveToDate}`} fromDate={effectiveFromDate} toDate={effectiveToDate} summary={(insights) => <DashboardMetricGrid
              monthly={monthly}
              periodComparison={insights?.comparison}
              ratingStats={insights?.quality.ratingStats}
              previousPeriodLabel={insights ? `${new Date(insights.period.previousFromDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – ${new Date(insights.period.previousToDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : undefined}
              periodLabel={insights ? `${new Date(insights.period.fromDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – ${new Date(insights.period.toDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Đang tải kỳ thống kê'}
              providers={providers}
            />} />
            <DashboardCharts orders={orders} query={{ fromDate: effectiveFromDate, toDate: effectiveToDate, topLimit: 5 }} />
            <DashboardRevenueSection key={`revenue:${effectiveFromDate}:${effectiveToDate}`} range={range} />
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
