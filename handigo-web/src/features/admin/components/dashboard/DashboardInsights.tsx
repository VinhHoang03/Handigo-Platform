import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { ChartCard, ChartDataTable, chartMoney, chartNumber } from "@/components/common/chart";
import { getErrorMessage } from "@/utils/apiError";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { adminDashboardApi } from "../../api/adminDashboard.api";
import type { AdminDashboardInsights, DashboardComparison } from "../../types/adminDashboard.types";
import { DashboardPendingWork } from "./DashboardPendingWork";

const dateLabel = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const number = (value: number) => chartNumber.format(value);
const money = (value: number) => chartMoney.format(value);
const percent = (value: number) => `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

function ComparisonCard({ title, metric, format }: { title: string; metric: DashboardComparison; format: (value: number) => string }) {
  const change = metric.changePercent;
  return <div className="min-w-0 rounded-xl border border-outline-variant/40 p-4">
    <h3 className="text-sm text-on-surface-variant">{title}</h3>
    <p className="mt-2 break-words text-2xl font-bold tabular-nums">{format(metric.current)}</p>
    <p className="mt-2 text-sm text-on-surface-variant">Kỳ trước: {format(metric.previous)}</p>
    <p className={`mt-1 text-sm font-semibold ${change === null || change === 0 ? "text-on-surface-variant" : change > 0 ? "text-success" : "text-error"}`}>
      {change === null ? metric.current === 0 ? "Chưa phát sinh ở cả hai kỳ" : "Mới phát sinh; kỳ trước bằng 0"
        : change === 0 ? "Không thay đổi" : `${change > 0 ? "Tăng" : "Giảm"} ${percent(Math.abs(change))}`}
    </p>
  </div>;
}

function ComparisonPanel({ data }: { data: AdminDashboardInsights }) {
  const { comparison, period } = data;
  const rate = comparison.cancellationRate;
  const comparable = comparison.orders.current > 0 && comparison.orders.previous > 0;
  return <ChartCard title="So sánh với kỳ trước" description={`Kỳ trước: ${dateLabel(period.previousFromDate)} – ${dateLabel(period.previousToDate)}, có cùng số ngày với kỳ đang xem.`}>
    <div className="grid gap-3 lg:grid-cols-3">
      <ComparisonCard title="Đơn tạo trong kỳ" metric={comparison.orders} format={number} />
      <ComparisonCard title="Phí nền tảng ghi nhận trong kỳ" metric={comparison.platformRevenue} format={money} />
      <div className="min-w-0 rounded-xl border border-outline-variant/40 p-4">
        <h3 className="text-sm text-on-surface-variant">Tỷ lệ hủy đơn</h3>
        <p className="mt-2 text-2xl font-bold tabular-nums">{comparison.orders.current ? percent(rate.current) : "—"}</p>
        <p className="mt-2 text-sm text-on-surface-variant">Kỳ trước: {comparison.orders.previous ? percent(rate.previous) : "Chưa có đơn"}</p>
        <p className={`mt-1 text-sm font-semibold ${!comparable || rate.changePoints === 0 ? "text-on-surface-variant" : rate.changePoints > 0 ? "text-error" : "text-success"}`}>
          {!comparable ? "Chưa đủ dữ liệu để so sánh" : rate.changePoints === 0 ? "Không thay đổi" : `${rate.changePoints > 0 ? "Tăng" : "Giảm"} ${Math.abs(rate.changePoints).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm phần trăm`}
        </p>
      </div>
    </div>
    <p className="mt-3 text-xs text-on-surface-variant">Số đơn và tỷ lệ hủy tính theo ngày tạo đơn; phí nền tảng tính theo ngày ghi nhận giao dịch phí thành công.</p>
  </ChartCard>;
}

function AttentionPanel({ data }: { data: AdminDashboardInsights["attentionOrders"] }) {
  const stats = [
    { label: "Chờ nhà cung cấp", value: data.awaitingProvider },
    { label: "Quá giờ hẹn", value: data.lateArrival },
    { label: "Thực hiện quá hạn", value: data.overdue },
  ];
  return <ChartCard title="Đơn cần chú ý" description="Trạng thái hiện tại; chỉ tính đơn chưa hoàn thành hoặc hủy.">
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-outline-variant/40 p-3">
        <p className="text-xs text-on-surface-variant">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{number(item.value)}</p>
      </div>)}
    </div>
    {data.items.length ? <>
      <p className="mb-3 text-xs text-on-surface-variant">Tối đa 5 đơn được tạo lâu nhất trong nhóm cần chú ý.</p>
      <ChartDataTable caption="Đơn cần chú ý" columns={["Mã đơn", "Trạng thái", "Mốc thời gian"]}
        rows={data.items.map((item) => [item.orderCode, getOrderStatusMeta(item.status).label,
          item.expectedAt ? new Date(item.expectedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : `Tạo ngày ${dateLabel(item.createdAt)}`])} />
    </> : <p className="py-6 text-center text-sm text-on-surface-variant">Không có đơn cần chú ý.</p>}
  </ChartCard>;
}

function CustomersPanel({ data }: { data: AdminDashboardInsights["customers"] }) {
  const stats = [
    { label: "Tài khoản khách hàng mới", value: data.newCustomers },
    { label: "Khách đặt đơn trong kỳ", value: data.bookingCustomers },
    { label: "Khách đặt lại trong kỳ", value: data.returningCustomers },
  ];
  return <ChartCard title="Khách hàng trong kỳ" description="Theo khoảng ngày của khối thông tin vận hành.">
    <dl className="space-y-4">{stats.map((item) => <div key={item.label} className="flex items-start justify-between gap-4">
      <dt className="text-sm text-on-surface-variant">{item.label}</dt><dd className="shrink-0 text-xl font-bold tabular-nums">{number(item.value)}</dd>
    </div>)}</dl>
    <p className="mt-5 text-xs leading-relaxed text-on-surface-variant">Khách đặt đơn được đếm một lần theo tài khoản, loại trừ đơn đã hủy. Khách đặt lại có ít nhất 2 đơn tính đến cuối kỳ, trong đó có ít nhất 1 đơn tạo trong kỳ. Tài khoản mới tính theo vai trò khách hàng hiện tại.</p>
  </ChartCard>;
}

function DepositsPanel({ data }: { data: AdminDashboardInsights["deposits"] }) {
  const stats = [
    { label: `Cọc đang giữ hiện tại (${number(data.heldCount)} giao dịch)`, value: data.heldAmount },
    { label: "Cọc có yêu cầu hoàn chưa thành công hiện tại", value: data.pendingRefundAmount },
    { label: "Cọc thu thành công trong kỳ", value: data.receivedAmount },
    { label: "Cọc đã hoàn trong kỳ", value: data.refundedAmount },
    { label: "Cọc đã bồi thường nhà cung cấp trong kỳ", value: data.compensatedAmount },
  ];
  return <ChartCard title="Tình trạng tiền cọc" description="Chỉ tiền cọc khảo sát, theo các giao dịch đã ghi nhận.">
    <dl className="space-y-4">{stats.map((item) => <div key={item.label} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <dt className="min-w-0 flex-1 text-sm text-on-surface-variant">{item.label}</dt><dd className="font-semibold tabular-nums">{money(item.value)}</dd>
    </div>)}</dl>
    <p className="mt-5 text-xs leading-relaxed text-on-surface-variant">Cọc đang giữ thuộc đơn còn xử lý và chưa chuyển bồi thường. Hai dòng đầu là số hiện tại; các dòng còn lại là phát sinh trong kỳ, không cộng chung thành doanh thu.</p>
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
    <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">Tối đa 5 nhà cung cấp; không tính khiếu nại đã bị từ chối hoặc hủy. Số khiếu nại là tín hiệu cần xem xét, chưa phải kết luận vi phạm.</p>
    <Link to="/admin/cases" className="mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở quản lý khiếu nại</Link>
  </ChartCard>;
}

export function DashboardInsights({ fromDate, toDate }: { fromDate?: string; toDate?: string }) {
  const [data, setData] = useState<AdminDashboardInsights | null>(null);
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
      <div className="min-w-0"><h2 className="text-title-lg font-bold">Thông tin vận hành</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{data ? `Trong kỳ ${dateLabel(data.period.fromDate)} – ${dateLabel(data.period.toDate)}` : "Đang xác định khoảng thống kê…"}{!fromDate && !toDate ? " · Mặc định 30 ngày gần nhất" : ""}</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Làm mới thông tin vận hành"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
        <RefreshCw size={19} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
      </button>
    </div>
    {data && error && <p role="alert" className="text-sm text-error">{error} Đang hiển thị dữ liệu lần cập nhật thành công gần nhất.</p>}
    <AsyncState loading={loading && !data} error={!data ? error : ""} onRetry={() => void load()} empty={!data}>
      {data && <div className="space-y-5" aria-busy={loading}>
        <DashboardPendingWork data={data.pendingWork} />
        <ComparisonPanel data={data} />
        <div className="grid min-w-0 gap-5 xl:grid-cols-2"><AttentionPanel data={data.attentionOrders} /><CustomersPanel data={data.customers} /></div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-2"><DepositsPanel data={data.deposits} /><QualityPanel data={data.quality} /></div>
        <p className="text-xs text-on-surface-variant">Dữ liệu cập nhật lúc {new Date(data.asOf).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.</p>
      </div>}
    </AsyncState>
  </section>;
}
