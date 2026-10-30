import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { useAdminRead } from "../../hooks/useAdminRead";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminDashboardInsights } from "../../types/adminDashboard.types";
import { DashboardPendingWork } from "./DashboardPendingWork";
import { AdminToastNotice } from '../shared/AdminToastNotice';


export function DashboardInsights({ fromDate, toDate, summary }: { fromDate?: string; toDate?: string; summary?: (data: AdminDashboardInsights | null) => ReactNode }) {
  const monthly = Boolean(fromDate?.endsWith("-01") && toDate === new Date(Date.UTC(Number(fromDate.slice(0, 4)), Number(fromDate.slice(5, 7)), 0)).toISOString().slice(0, 10));
  const requestKey = String(fromDate) + ":" + String(toDate);
  const state = useAdminRead(requestKey, signal => adminDashboardApi.insights({ fromDate, toDate }, signal), { delay: 0, errorMessage: "Không thể tải thông tin vận hành. Vui lòng thử lại." });
  const data = state.dataKey === requestKey ? state.data : null;
  const { loading, error, reload: load } = state;

  return <section className="min-w-0 space-y-5" aria-label="Thông tin vận hành bổ sung">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-title-lg font-bold">Thông tin vận hành</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{monthly ? "Tháng đang xem" : "Theo ngày chọn"}</span></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Làm mới thông tin vận hành"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
        <RefreshCw size={19} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
      </button>
    </div>
    {data && <AdminToastNotice message={error} />}
    <DashboardPendingWork data={data?.pendingWork}>{summary?.(data)}</DashboardPendingWork>
    <AsyncState loading={loading && !data} error={!data ? error : ""} onRetry={() => void load()} empty={!data}>
      {null}
    </AsyncState>
  </section>;
}
