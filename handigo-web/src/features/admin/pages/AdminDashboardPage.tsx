import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { DashboardMetricGrid } from "../components/dashboard/DashboardMetricGrid";
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
  const [providers, setProviders] = useState<AdminProviderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setError(getErrorMessage(requestError, "Không thể tải dashboard quản trị."));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-primary">
            Vận hành hệ thống
          </p>
          <h1 className="mt-1 text-headline-lg font-bold">Dashboard quản trị</h1>
          <p className="mt-2 text-on-surface-variant">
            Theo dõi doanh thu, đơn dịch vụ, provider và yêu cầu rút tiền từ dữ liệu backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:grid-cols-2 lg:max-w-2xl">
        <label className="text-sm font-semibold">
          Từ ngày
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant px-3"
          />
        </label>
        <label className="text-sm font-semibold">
          Đến ngày
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant px-3"
          />
        </label>
      </section>

      <AsyncState
        loading={loading}
        error={error}
        empty={!overview || !orders || !providers}
        emptyMessage="Chưa có dữ liệu dashboard."
        onRetry={load}
      >
        {overview && orders && providers && (
          <>
            <DashboardMetricGrid overview={overview} orders={orders} providers={providers} />
            <DashboardCharts orders={orders} providers={providers} />
          </>
        )}
      </AsyncState>
    </DashboardShell>
  );
}
