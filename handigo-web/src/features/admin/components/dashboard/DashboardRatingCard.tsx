import { Link } from "react-router-dom";
import { ArrowUpRight, Minus, Star, TrendingDown, TrendingUp } from "lucide-react";
import { chartNumber } from "@/components/common/chart";
import type { DashboardRatingStats } from "../../types/adminDashboard.types";

const stars = (value: number) => value.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DashboardRatingCard({ data, periodLabel, previousPeriodLabel, monthly }: {
  data?: DashboardRatingStats;
  periodLabel: string;
  previousPeriodLabel?: string;
  monthly?: boolean;
}) {
  const current = data?.current;
  const previous = data?.previous;
  const hasCurrent = Boolean(current?.ratedOrders);
  const hasPrevious = Boolean(previous?.ratedOrders);
  const change = data?.changePercent;
  const TrendIcon = change != null && change > 0 ? TrendingUp : change != null && change < 0 ? TrendingDown : Minus;
  const previousLabel = monthly ? "tháng trước" : "khoảng trước";
  const changeText = !hasCurrent ? "Chưa có đánh giá"
    : !hasPrevious || change == null ? `Chưa có đánh giá ${previousLabel} để so sánh`
      : change === 0 ? "0% · Không thay đổi"
        : `${change > 0 ? "+" : "−"}${Math.abs(change).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% so với ${previousLabel}`;
  const rows = current ? [
    { label: "5 sao", value: current.fiveStar },
    { label: "4 đến dưới 5 sao", value: current.fourToFive },
    { label: "Dưới 4 sao", value: current.belowFour },
    { label: "Trong đó dưới 3 sao", value: current.belowThree, nested: true },
    { label: "Trong đó dưới 2 sao", value: current.belowTwo, nested: true },
  ] : [];

  return <Link to="/admin/feedbacks" className="dashboard-metric dashboard-rating min-w-0 rounded-xl border border-outline-variant/40 p-4 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
    title={`Kỳ ${periodLabel}. Điểm trung bình từ đánh giá của các đơn đã hoàn thành, mỗi đơn có trọng số như nhau. Theo ngày tạo đánh giá; gồm cả đánh giá bị ẩn.`}>
    <div className="flex items-start gap-2"><Star aria-hidden="true" size={20} className="shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm font-medium">Điểm nhà cung cấp trung bình</p><ArrowUpRight aria-hidden="true" size={16} className="shrink-0 text-primary" /></div>
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-bold tabular-nums">
      <span>{hasCurrent && current ? `${stars(current.averageRating)}/5` : "—"}<span className="ml-1 text-sm font-normal text-on-surface-variant">sao</span></span>
      <span className="text-xs font-normal tracking-normal text-on-surface-variant">{data ? `${chartNumber.format(current?.ratedOrders ?? 0)} đánh giá` : "Đang tải đánh giá…"}</span>
    </p>
    {data && <div className="dashboard-rating-comparison mt-3 space-y-1 text-xs">
      <p className="text-on-surface-variant" title={previousPeriodLabel}>{monthly ? "Tháng trước" : "Khoảng trước"}: {hasPrevious && previous ? `${stars(previous.averageRating)}/5 sao · ${chartNumber.format(previous.ratedOrders)} đánh giá` : "Chưa có đánh giá"}</p>
      <p className={`flex items-start gap-1.5 font-semibold tabular-nums ${hasCurrent && hasPrevious && change != null && change > 0 ? "text-green-600" : hasCurrent && hasPrevious && change != null && change < 0 ? "text-red-600" : "text-on-surface-variant"}`}>
        <TrendIcon aria-hidden="true" size={17} className="shrink-0" />
        <span>{!hasCurrent || !hasPrevious || change == null ? changeText : <><span className="sr-only">{change > 0 ? "Tăng " : change < 0 ? "Giảm " : ""}</span>{changeText}</>}</span>
      </p>
    </div>}
    {data && <dl className="mt-3 space-y-1.5 text-xs tabular-nums">
      {rows.map((row) => <div key={row.label} className={`flex items-start justify-between gap-3 ${row.nested ? "pl-3 text-on-surface-variant" : ""}`}>
        <dt className="min-w-0">{row.label}</dt>
        {!row.nested && <span className="dashboard-rating-track" aria-hidden="true"><span style={{ width: `${current?.ratedOrders ? Math.min(100, row.value / current.ratedOrders * 100) : 0}%` }} /></span>}
        <dd className="shrink-0 font-semibold">{chartNumber.format(row.value)}</dd>
      </div>)}
    </dl>}
  </Link>;
}
