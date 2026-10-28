import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { AdminDatePicker } from "../components/shared/AdminDatePicker";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { revenueRangeFromSearch } from "../components/revenue/revenue-period";
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
  const [params] = useSearchParams();
  const initialRange = revenueRangeFromSearch(params.toString());
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const defaultPeriod = currentDashboardMonth();
  const effectiveFromDate = fromDate || defaultPeriod.fromDate;
  const effectiveToDate = toDate || defaultPeriod.toDate;
  const [orders, setOrders] = useState<AdminOrderAnalytics | null>(null);
  const [providers, setProviders] = useState<AdminProviderAnalytics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastFeedback<string>("", "error");

  const load = useCallback(async () => {
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
      setOrders(orderData);
      setProviders(providerData);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể tải tổng quan quản trị."),
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveFromDate, setError, effectiveToDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header">
        <div>
          <AdminPageTitle title="Tổng quan quản trị" />
        </div>
        <div className="admin-header-actions">
        <div className="admin-date-range" role="group" aria-label="Khoảng thời gian thống kê">
        <AdminDatePicker label="Từ ngày" compact value={effectiveFromDate} max={effectiveToDate} onChange={setFromDate} />
        <AdminDatePicker label="Đến ngày" compact value={effectiveToDate} min={effectiveFromDate} onChange={setToDate} />
        </div>
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
            <DashboardInsights key={`${effectiveFromDate}:${effectiveToDate}`} fromDate={effectiveFromDate} toDate={effectiveToDate} summary={(insights) => <DashboardMetricGrid
              monthly={effectiveFromDate.endsWith("-01") && effectiveToDate === new Date(Date.UTC(Number(effectiveFromDate.slice(0, 4)), Number(effectiveFromDate.slice(5, 7)), 0)).toISOString().slice(0, 10)}
              revenuePath={`/admin/revenue?${new URLSearchParams({ fromDate: effectiveFromDate, toDate: effectiveToDate })}`}
              periodComparison={insights?.comparison}
              ratingStats={insights?.quality.ratingStats}
              previousPeriodLabel={insights ? `${new Date(insights.period.previousFromDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – ${new Date(insights.period.previousToDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : undefined}
              periodLabel={insights ? `${new Date(insights.period.fromDate).toLocaleDateString('vi-VN')} – ${new Date(insights.period.toDate).toLocaleDateString('vi-VN')}` : 'Đang tải kỳ thống kê'}
              providers={providers}
            />} />
            <DashboardCharts orders={orders} providers={providers} query={{ fromDate: effectiveFromDate, toDate: effectiveToDate, topLimit: 5 }} />
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
