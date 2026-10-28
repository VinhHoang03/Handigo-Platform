import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { ChartCard, ChartDataTable, chartNumber } from "@/components/common/chart";
import { getErrorMessage } from "@/utils/apiError";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminDashboardInsights } from "../../types/adminDashboard.types";
import { DashboardPendingWork } from "./DashboardPendingWork";
import { AdminFeedbackDetailModal } from "../feedback/AdminFeedbackDetailModal";

const dateLabel = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const number = (value: number) => chartNumber.format(value);

function AttentionPanel({ data, onOpen }: { data: AdminDashboardInsights["attentionOrders"]; onOpen: (id: string) => void }) {
  const stats = [
    { label: "Chờ nhà cung cấp", value: data.awaitingProvider },
    { label: "Quá giờ hẹn", value: data.lateArrival },
    { label: "Thực hiện quá hạn", value: data.overdue },
  ];
  return <ChartCard title="Đơn cần chú ý" description="Trạng thái hiện tại; chỉ tính đơn chưa hoàn thành hoặc hủy.">
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.sort((a, b) => b.value - a.value).map((item) => <a href="#admin-attention-orders" key={item.label} className={`min-w-0 rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-primary ${item.value > 0 ? 'border-warning/40 bg-warning-container/40 text-on-warning-container' : 'border-outline-variant/40 text-on-surface-variant'}`}>
        <p className="text-xs text-on-surface-variant">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{number(item.value)}</p>
      </a>)}
    </div>
    {data.items.length ? <>
      <p className="mb-3 text-xs text-on-surface-variant">5 đơn lâu nhất · Bấm mã đơn để xem chi tiết</p>
      <div id="admin-attention-orders" className="scroll-mt-28">
      <ChartDataTable caption="Đơn cần chú ý" columns={["Mã đơn", "Trạng thái", "Mốc thời gian"]}
        rows={data.items.map((item) => [<button type="button" onClick={() => onOpen(item.id)} className="min-h-11 text-left font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{item.orderCode}</button>, getOrderStatusMeta(item.status).label,
          item.expectedAt ? new Date(item.expectedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : `Tạo ngày ${dateLabel(item.createdAt)}`])} />
      </div>
    </> : <p className="py-6 text-center text-sm text-on-surface-variant">Không có đơn cần chú ý.</p>}
  </ChartCard>;
}

function QualityPanel({ data }: { data: AdminDashboardInsights["quality"] }) {
  return <ChartCard title="Cảnh báo chất lượng" description="Đánh giá thấp và nhà cung cấp có nhiều khiếu nại trong kỳ.">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm text-on-surface-variant">Đánh giá từ 1 đến 2 sao</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(data.lowRatings)} <span className="text-sm font-normal text-on-surface-variant">/ {number(data.totalRatings)} đánh giá</span></p></div>
      <Link to="/admin/feedbacks" className="rounded-lg py-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Xem đánh giá</Link>
    </div>
    <h3 className="mb-3 mt-5 text-sm font-semibold">Nhà cung cấp có từ 2 khiếu nại</h3>
    {data.providers.length ? <ChartDataTable caption="Nhà cung cấp có nhiều khiếu nại" columns={["Nhà cung cấp", "Khiếu nại"]}
      rows={data.providers.map((item) => [item.fullName || "Nhà cung cấp", number(item.complaintCount)])} />
      : <p className="text-sm text-on-surface-variant">Chưa có nhà cung cấp có từ 2 khiếu nại trong kỳ.</p>}
    <details className="mt-3 text-xs text-on-surface-variant"><summary className="cursor-pointer py-2">Phạm vi cảnh báo</summary><p>Tối đa 5 nhà cung cấp; không tính khiếu nại bị từ chối hoặc hủy. Đây là tín hiệu cần xem xét, chưa phải kết luận vi phạm.</p></details>
    <Link to="/admin/cases" className="mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở quản lý khiếu nại</Link>
  </ChartCard>;
}

export function DashboardInsights({ fromDate, toDate, summary }: { fromDate?: string; toDate?: string; summary?: (data: AdminDashboardInsights | null) => ReactNode }) {
  const monthly = Boolean(fromDate?.endsWith("-01") && toDate === new Date(Date.UTC(Number(fromDate.slice(0, 4)), Number(fromDate.slice(5, 7)), 0)).toISOString().slice(0, 10));
  const [data, setData] = useState<AdminDashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const id = ++requestRef.current;
    setLoading(true);
    try {
      const result = await adminDashboardApi.insights({ fromDate, toDate });
      if (id === requestRef.current) { setData(result); setError(""); }
    } catch (requestError) {
      if (id === requestRef.current) setError(getErrorMessage(requestError, "Không thể tải thông tin vận hành. Vui lòng thử lại."));
    } finally {
      busyRef.current = false;
      if (id === requestRef.current) setLoading(false);
    }
  }, [fromDate, toDate]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => { requestRef.current += 1; window.clearTimeout(timer); };
  }, [load]);

  return <section className="min-w-0 space-y-5" aria-label="Thông tin vận hành bổ sung">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-title-lg font-bold">Thông tin vận hành</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{monthly ? "Tháng đang xem" : "Theo ngày chọn"}</span></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Làm mới thông tin vận hành"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
        <RefreshCw size={19} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
      </button>
    </div>
    {data && error && <p role="alert" className="text-sm text-error">{error} Đang hiển thị dữ liệu lần cập nhật thành công gần nhất.</p>}
    <DashboardPendingWork data={data?.pendingWork}>{summary?.(data)}</DashboardPendingWork>
    <AsyncState loading={loading && !data} error={!data ? error : ""} onRetry={() => void load()} empty={!data}>
      {data && <div className="space-y-5" aria-busy={loading}>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><AttentionPanel data={data.attentionOrders} onOpen={setSelectedOrderId} /><QualityPanel data={data.quality} /></div>
      </div>}
    </AsyncState>
    {selectedOrderId && <AdminFeedbackDetailModal key={selectedOrderId} orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}
  </section>;
}
