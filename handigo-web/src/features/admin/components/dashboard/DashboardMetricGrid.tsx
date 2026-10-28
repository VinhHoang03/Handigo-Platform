import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AdminDashboardInsights, DashboardComparison } from "../../types/adminDashboard.types";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardList,
  WalletCards,
} from "lucide-react";
import { chartMoney, chartNumber } from "@/components/common/chart";
import { DashboardUserStats } from "./DashboardUserStats";
import { DashboardRatingCard } from "./DashboardRatingCard";
import type {
  AdminProviderAnalytics,
} from "../../types/adminOperations.types";

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  path,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  path: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Link to={path} title={hint} data-metric={path.startsWith('/admin/revenue') ? 'revenue' : 'orders'} className="dashboard-metric min-w-0 rounded-xl border border-outline-variant/40 p-4 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary">
      <div className="flex items-start gap-2"><Icon aria-hidden="true" size={20} className="shrink-0 text-primary" /><p className="min-w-0 flex-1 text-sm font-medium">{label}</p><ArrowUpRight aria-hidden="true" size={16} className="shrink-0 text-primary" /></div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 break-words text-2xl font-bold tabular-nums">{value}</p>
        <div className="ml-auto max-w-[48%] shrink-0 text-right text-xs text-on-surface-variant">
          <p>{note}</p>
        </div>
      </div>
      {children && <div className="mt-3 space-y-1 border-t border-outline-variant/30 pt-3 text-xs tabular-nums">{children}</div>}
    </Link>
  );
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function PeriodComparison({ metric, format, periodLabel, monthly }: {
  metric: DashboardComparison;
  format: (value: number) => string;
  periodLabel?: string;
  monthly?: boolean;
}) {
  const change = metric.changePercent;
  const previousLabel = monthly ? "tháng trước" : "khoảng trước";
  const delta = metric.current - metric.previous;
  return <>
    <p className="text-on-surface-variant" title={periodLabel}>{monthly ? "Tháng trước" : "Khoảng trước"}: {format(metric.previous)}{periodLabel && ` (${periodLabel})`}</p>
    <p className={`font-semibold ${change == null || change === 0 ? "text-on-surface-variant" : change > 0 ? "text-success" : "text-error"}`}>
      {change == null ? metric.current === 0 ? "Chưa phát sinh" : `Tăng ${format(delta)} · ${previousLabel} bằng 0, chưa tính được %`
        : change === 0 ? `Không thay đổi so với ${previousLabel}` : `${change > 0 ? "Tăng" : "Giảm"} ${Math.abs(change).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% (${format(Math.abs(delta))}) so với ${previousLabel}`}
    </p>
  </>;
}

export function DashboardMetricGrid({
  providers,
  periodComparison,
  periodLabel,
  previousPeriodLabel,
  ratingStats,
  monthly = false,
  revenuePath = "/admin/revenue",
}: {
  monthly?: boolean;
  revenuePath?: string;
  providers: AdminProviderAnalytics;
  periodComparison?: AdminDashboardInsights['comparison'];
  periodLabel: string;
  previousPeriodLabel?: string;
  ratingStats?: AdminDashboardInsights['quality']['ratingStats'];
}) {
  return (
    <>
      <DashboardUserStats providers={providers} />
      <MetricCard
        icon={WalletCards}
        label={monthly ? "Doanh thu nền tảng trong tháng" : "Doanh thu theo ngày chọn"}
        path={revenuePath}
        value={periodComparison ? chartMoney.format(periodComparison.platformRevenue.current) : '—'}
        note="Xem báo cáo doanh thu"
        hint={`Phí nền tảng trong khoảng ${periodLabel}`}
      >
        {periodComparison && <PeriodComparison metric={periodComparison.platformRevenue} format={(value) => chartMoney.format(value)} periodLabel={previousPeriodLabel} monthly={monthly} />}
      </MetricCard>
      <MetricCard
        icon={ClipboardList}
        label={monthly ? "Đơn tạo trong tháng" : "Đơn theo ngày chọn"}
        path="/admin/payments"
        value={periodComparison ? chartNumber.format(periodComparison.orders.current) : '—'}
        note={periodComparison ? `Hủy ${percent(periodComparison.cancellationRate.current / 100)}` : 'Đang tải tỷ lệ hủy'}
        hint={`Đơn tạo trong kỳ ${periodLabel}`}
      >
        {periodComparison && <>
          <PeriodComparison metric={periodComparison.orders} format={(value) => `${chartNumber.format(value)} đơn`} periodLabel={previousPeriodLabel} monthly={monthly} />
          <p className="text-on-surface-variant">{monthly ? "Tỷ lệ hủy tháng trước" : "Tỷ lệ hủy khoảng trước"}: {periodComparison.orders.previous ? percent(periodComparison.cancellationRate.previous / 100) : "Chưa có đơn"}</p>
          <p className={`font-semibold ${!periodComparison.orders.current || !periodComparison.orders.previous || periodComparison.cancellationRate.changePoints === 0 ? "text-on-surface-variant" : periodComparison.cancellationRate.changePoints > 0 ? "text-error" : "text-success"}`}>
            {!periodComparison.orders.current || !periodComparison.orders.previous ? "Chưa đủ dữ liệu so sánh tỷ lệ hủy"
              : periodComparison.cancellationRate.changePoints === 0 ? "Tỷ lệ hủy không thay đổi"
                : `Tỷ lệ hủy ${periodComparison.cancellationRate.changePoints > 0 ? "tăng" : "giảm"} ${Math.abs(periodComparison.cancellationRate.changePoints).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm phần trăm`}
          </p>
        </>}
      </MetricCard>
      <DashboardRatingCard data={ratingStats} periodLabel={periodLabel} previousPeriodLabel={previousPeriodLabel} monthly={monthly} />
    </>
  );
}
