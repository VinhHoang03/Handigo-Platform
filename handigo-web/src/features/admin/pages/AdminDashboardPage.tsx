import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ClipboardList, RefreshCw, UserRoundCheck, WalletCards } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../api/adminOperations.api";
import type {
  AdminOrderAnalytics,
  AdminOverview,
  AdminProviderAnalytics,
} from "../types/adminOperations.types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string; note: string }) {
  return <article className="rounded-2xl border border-outline-variant/40 bg-surface p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></span><div><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-on-surface-variant">{note}</p></div></div></article>;
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="space-y-4">{rows.map((row) => <div key={row.label}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{row.label}</span><b>{row.value}</b></div><div className="h-2 overflow-hidden rounded-full bg-surface-container"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }} /></div></div>)}</div>;
}

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
      const query = { fromDate: fromDate || undefined, toDate: toDate || undefined, topLimit: 5 };
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

  const orderStatusRows = useMemo(() => orders?.ordersByStatus.map((item) => ({ label: item.status, value: item.count })) || [], [orders]);
  const categoryRows = useMemo(() => orders?.ordersByServiceCategory.map((item) => ({ label: item.categoryName, value: item.count })) || [], [orders]);

  return <DashboardShell role="ADMIN">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-wider text-primary">Vận hành hệ thống</p><h1 className="mt-1 text-headline-lg font-bold">Dashboard quản trị</h1><p className="mt-2 text-on-surface-variant">Theo dõi doanh thu, đơn dịch vụ, provider và yêu cầu rút tiền từ dữ liệu backend.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới</button></header>
    <section className="grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:grid-cols-2 lg:max-w-2xl"><label className="text-sm font-semibold">Từ ngày<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant px-3" /></label><label className="text-sm font-semibold">Đến ngày<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant px-3" /></label></section>
    <AsyncState loading={loading} error={error} empty={!overview || !orders || !providers} emptyMessage="Chưa có dữ liệu dashboard." onRetry={load}>
      {overview && orders && providers && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={WalletCards} label="Tổng doanh thu" value={money.format(overview.totalRevenue)} note={`Doanh thu nền tảng ${money.format(overview.platformRevenue)}`} /><MetricCard icon={ClipboardList} label="Tổng đơn" value={overview.totalOrders.toLocaleString("vi-VN")} note={`${overview.completedOrders} hoàn thành · ${overview.cancelledOrders} đã hủy`} /><MetricCard icon={UserRoundCheck} label="Provider đang hoạt động" value={providers.activeProviders.toLocaleString("vi-VN")} note={`${providers.onlineProviders} đang trực tuyến / ${providers.totalProviders} hồ sơ`} /><MetricCard icon={Activity} label="Yêu cầu rút đang chờ" value={overview.pendingWithdrawals.toLocaleString("vi-VN")} note={money.format(overview.pendingWithdrawalAmount)} /></section>
        <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-outline-variant/40 bg-surface p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Đơn theo trạng thái</h2><span className="text-sm text-on-surface-variant">Hoàn thành {(orders.completionRate * 100).toFixed(1)}%</span></div><BarList rows={orderStatusRows} /></article><article className="rounded-2xl border border-outline-variant/40 bg-surface p-5"><h2 className="mb-5 text-lg font-bold">Đơn theo danh mục</h2><BarList rows={categoryRows} /></article></section>
        <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-outline-variant/40 bg-surface p-5"><h2 className="mb-4 text-lg font-bold">Provider theo doanh thu</h2><div className="space-y-3">{providers.topProvidersByRevenue.map((provider, index) => <div key={provider.providerId} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3"><span className="font-semibold">{index + 1}. {provider.fullName || provider.email || "Provider"}</span><b className="text-primary">{money.format(provider.revenue)}</b></div>)}</div></article><article className="rounded-2xl border border-outline-variant/40 bg-surface p-5"><h2 className="mb-4 text-lg font-bold">Provider theo đơn hoàn thành</h2><div className="space-y-3">{providers.topProvidersByCompletedOrders.map((provider, index) => <div key={provider.providerId} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3"><span className="font-semibold">{index + 1}. {provider.fullName || provider.email || "Provider"}</span><b>{provider.completedOrders} đơn</b></div>)}</div></article></section>
      </>}
    </AsyncState>
  </DashboardShell>;
}
