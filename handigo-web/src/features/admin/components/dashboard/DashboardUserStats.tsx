import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Users, Radio } from "lucide-react";
import { chartNumber } from "@/components/common/chart";
import { getErrorMessage } from "@/utils/apiError";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminUserPresence } from "../../types/adminDashboard.types";

export function DashboardUserStats() {
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

  return <section aria-label="Thống kê tài khoản" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-title-lg font-bold">Người dùng trong hệ thống</h2>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Làm mới thống kê người dùng"
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
        <RefreshCw size={17} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
        <span>Cập nhật mỗi 30 giây</span>
      </button>
    </div>
    <div className="grid gap-4 md:grid-cols-2" aria-busy={loading}>
      <article className="flex items-start gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
        <Users aria-hidden="true" className="mt-1 shrink-0 text-primary" />
        <div className="min-w-0"><h3 className="text-sm text-on-surface-variant">Người dùng đã đăng ký</h3>
          <p className="mt-1 text-headline-md font-bold tabular-nums">{data ? chartNumber.format(data.totalRegisteredUsers) : "—"}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Gồm mọi vai trò; không tính tài khoản đã xóa.</p></div>
      </article>
      <article className="flex items-start gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
        <Radio aria-hidden="true" className="mt-1 shrink-0 text-success" />
        <div className="min-w-0"><h3 className="text-sm text-on-surface-variant">Người dùng đang online</h3>
          <p className="mt-1 text-headline-md font-bold tabular-nums">{data?.onlineUsers == null ? "—" : chartNumber.format(data.onlineUsers)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{data?.onlineUsers === null ? "Chưa xác định được kết nối realtime." : "Tài khoản đang kết nối realtime; mỗi người chỉ tính một lần."}</p></div>
      </article>
    </div>
    <div role="status" className="text-xs text-on-surface-variant">{data ? `Cập nhật lúc ${new Date(data.asOf).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Số liệu hiện tại, không phụ thuộc bộ lọc ngày.` : loading ? "Đang tải thống kê người dùng…" : "Chưa có số liệu người dùng."}</div>
    {error && <p role="alert" className="text-sm text-error">{error}{data ? " Số liệu trên là lần cập nhật thành công gần nhất." : ""}</p>}
  </section>;
}
