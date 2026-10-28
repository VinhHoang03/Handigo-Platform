import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { DashboardMetricGrid } from "../components/dashboard/DashboardMetricGrid";
import { DashboardUserStats } from "../components/dashboard/DashboardUserStats";
import { DashboardInsights } from "../components/dashboard/DashboardInsights";
import type {
  AdminOrderAnalytics,
  AdminOverview,
  AdminProviderAnalytics,
} from "../types/adminOperations.types";

export default function AdminDashboardPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
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
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        topLimit: 5,
      };
      const [overviewData, orderData, providerData] = await Promise.all([
        adminOperationsApi.overview(query),
        adminOperationsApi.orderAnalytics(query),
        adminOperationsApi.providerAnalytics(query),
      ]);
      setOverview(overviewData);
      setOrders(orderData);
      setProviders(providerData);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể tải tổng quan quản trị."),
      );
    } finally {
      setLoading(false);
    }
  }, [fromDate, setError, toDate]);

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
        <label>
          <span>Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
        </div>
        <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
        </div>
      </header>

      <AsyncState
        loading={loading}
        error={error}
        empty={!overview || !orders || !providers}
        emptyMessage="Chưa có dữ liệu tổng quan."
        onRetry={load}
      >
        {overview && orders && providers && (
          <>
            <DashboardUserStats />
            <DashboardMetricGrid
              overview={overview}
              orders={orders}
              providers={providers}
            />
            <DashboardInsights key={`${fromDate}:${toDate}`} fromDate={fromDate || undefined} toDate={toDate || undefined} />
            <DashboardCharts orders={orders} providers={providers} query={{ fromDate: fromDate || undefined, toDate: toDate || undefined, topLimit: 5 }} />
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
