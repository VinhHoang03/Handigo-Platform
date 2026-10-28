import { useCallback, useEffect, useRef, useState } from "react";
import { Users, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { chartNumber } from "@/components/common/chart";
import { getErrorMessage } from "@/utils/apiError";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminUserPresence } from "../../types/adminDashboard.types";
import type { AdminProviderAnalytics } from "../../types/adminOperations.types";

export function DashboardUserStats({ providers }: { providers: AdminProviderAnalytics }) {
  const [data, setData] = useState<AdminUserPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const id = ++requestRef.current;
    setLoading(true);
    try {
      const result = await adminDashboardApi.presence();
      if (id === requestRef.current) { setData(result); setError(""); }
    } catch (requestError) {
      if (id === requestRef.current) setError(getErrorMessage(requestError, "Không thể cập nhật số người dùng. Vui lòng thử lại."));
    } finally {
      busyRef.current = false;
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => void load(), 0);
    const poll = () => { if (!document.hidden) void load(); };
    const interval = window.setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", poll);
    return () => { requestRef.current += 1; window.clearTimeout(start); window.clearInterval(interval); document.removeEventListener("visibilitychange", poll); };
  }, [load]);

  return <article aria-label="Thống kê tài khoản" aria-busy={loading} className="dashboard-metric dashboard-user-stats relative min-w-0 rounded-xl border border-outline-variant/40 p-4 hover:border-primary/50">
    <Link to="/admin/users" aria-label="Xem người dùng hệ thống" className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-primary" />
    <div className="flex items-start gap-3">
      <Users aria-hidden="true" size={20} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm text-on-surface-variant">Người dùng hệ thống</h3>
      </div>
      <ArrowUpRight aria-hidden="true" size={16} className="pointer-events-none shrink-0 text-primary" />
    </div>
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-2xl font-bold tabular-nums">{data ? chartNumber.format(data.totalRegisteredUsers) : "—"}</p>
      <dl className="space-y-1 text-right text-xs text-on-surface-variant">
        <div className="flex justify-end gap-1"><dt>Online:</dt><dd className="font-semibold tabular-nums text-success">{data?.onlineUsers == null ? "—" : chartNumber.format(data.onlineUsers)}</dd></div>
        <div className="flex justify-end gap-1"><dt>Thợ hoạt động:</dt><dd className="font-semibold tabular-nums text-on-surface">{chartNumber.format(providers.activeProviders)}</dd></div>
        <div className="flex justify-end gap-1" title="Số người dùng đăng ký mới trong 7 ngày gần nhất"><dt>Số người dùng mới:</dt><dd className="font-semibold tabular-nums text-on-surface">{data?.newUsersLast7Days == null ? "—" : chartNumber.format(data.newUsersLast7Days)}</dd></div>
      </dl>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}{data ? " Số liệu trên là lần cập nhật thành công gần nhất." : ""}</p>}
  </article>;
}
