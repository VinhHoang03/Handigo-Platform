import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { revenueRangeFromSearch } from "../components/revenue/revenue-period";
import { RevenueRangeFilter } from "../components/revenue/RevenueRangeFilter";
import { createRange } from "../components/revenue/revenue-format";
import type { RevenueQuery } from "../types/adminRevenue.types";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { adminOperationsApi } from "../api/adminOperations.api";
import { currentDashboardMonth } from "../components/dashboard/dashboard-period";
import "../components/dashboard/dashboard-operations.css";
import { useAdminRead } from "../hooks/useAdminRead";
import { DashboardContent, type DashboardSnapshot } from "../components/dashboard/DashboardContent";

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
  const requestKey = effectiveFromDate + ":" + effectiveToDate;
  const read = useCallback(async (signal: AbortSignal): Promise<DashboardSnapshot> => {
    const query = { fromDate: effectiveFromDate, toDate: effectiveToDate, topLimit: 5 };
    const [orders, providers] = await Promise.all([
      adminOperationsApi.orderAnalytics(query, signal), adminOperationsApi.providerAnalytics(query, signal),
    ]);
    return { range: { fromDate: effectiveFromDate, toDate: effectiveToDate }, orders, providers };
  }, [effectiveFromDate, effectiveToDate]);
  const { data, loading, error, reload } = useAdminRead(requestKey, read, { errorMessage: "Không thể tải tổng quan quản trị." });

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header admin-revenue-header admin-overview-header">
        <div>
          <AdminPageTitle title="Tổng quan quản trị" />
        </div>
        <div className="admin-header-actions justify-end">
        <button type="button" onClick={() => setRange(currentDashboardMonth())} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold">Tháng này</button>
        <RevenueRangeFilter range={range} onPreset={(days) => setRange(createRange(days))} onChange={setRange} />
        <AdminRefreshButton onRefresh={reload} loading={loading} />
        </div>
      </header>

      {data && loading && <p role="status" className="my-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-on-surface-variant">Đang cập nhật bộ lọc. Số liệu đang hiển thị thuộc kỳ {data.range.fromDate} – {data.range.toDate}.</p>}
      {data && error && <p role="alert" className="my-4 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error} Số liệu kỳ trước vẫn được giữ. <button type="button" onClick={reload} className="min-h-10 font-semibold underline">Thử lại</button></p>}
      <AsyncState loading={loading && !data} error={!data ? error : ""} empty={!data} emptyMessage="Chưa có dữ liệu tổng quan." onRetry={reload}>
        {data && <DashboardContent snapshot={data} />}
      </AsyncState>
    </DashboardShell>
  );
}
