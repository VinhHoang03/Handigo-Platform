import { SeriesChartView, chartCompactMoney, chartMoney, dayLabel } from "@/components/common/chart";
import type { RevenueSeriesPoint } from "../../types/adminRevenue.types";
import { useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export function CollectionChart({ points, type = "bar" }: { points: RevenueSeriesPoint[]; type?: string }) {
  const [windowSize, setWindowSize] = useState<number | null>(31);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const count = Math.min(points.length, Math.max(1, windowSize ?? points.length));
  const maxStart = Math.max(0, points.length - count);
  const start = Math.max(0, maxStart - Math.min(offsetFromEnd, maxStart));
  const visiblePoints = points.slice(start, start + count);
  const buttonClass = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-sm tabular-nums text-on-surface-variant">
        Hiển thị {count}/{points.length} mốc ngày
        {visiblePoints.length > 0 && ` · ${dayLabel(visiblePoints[0].day ?? "")} – ${dayLabel(visiblePoints[visiblePoints.length - 1].day ?? "")}`}
      </p>
      <div role="group" aria-label="Phóng to và thu nhỏ biểu đồ" className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} aria-label="Thu nhỏ để xem nhiều mốc ngày hơn" title="Thu nhỏ: xem nhiều mốc ngày hơn"
          disabled={count >= points.length} onClick={() => setWindowSize(Math.min(points.length, Math.max(count + 1, Math.ceil(count * 1.5))))}>
          <ZoomOut aria-hidden="true" size={18} />
        </button>
        <button type="button" className={buttonClass} aria-label="Phóng to để xem ít mốc ngày hơn" title="Phóng to: xem ít mốc ngày hơn"
          disabled={count <= 1} onClick={() => setWindowSize(Math.max(1, Math.floor(count / 1.5)))}>
          <ZoomIn aria-hidden="true" size={18} />
        </button>
        <button type="button" className={buttonClass} disabled={!points.length} onClick={() => { setWindowSize(null); setOffsetFromEnd(0); }}>
          Xem tất cả
        </button>
        <button type="button" className={buttonClass} disabled={!points.length} aria-label="Đặt lại về tối đa 31 mốc ngày gần nhất" title="Đặt lại về tối đa 31 mốc ngày gần nhất"
          onClick={() => { setWindowSize(31); setOffsetFromEnd(0); }}>
          <RotateCcw aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
    <SeriesChartView title="Dòng tiền thu theo ngày" type={type} xKey="day"
      data={visiblePoints.map((point) => ({ day: point.day ?? "", amount: point.amount }))}
      series={[{ dataKey: "amount", name: "Tiền thu" }]} formatX={dayLabel}
      formatValue={(value) => chartMoney.format(value)} formatY={(value) => chartCompactMoney.format(value)} />
    {maxStart > 0 && (
      <label className="mt-4 block text-xs text-on-surface-variant">
        Di chuyển khoảng ngày đang xem
        <input type="range" min={0} max={maxStart} step={1} value={start}
          onChange={(event) => setOffsetFromEnd(maxStart - Number(event.target.value))}
          aria-valuetext={visiblePoints.length ? `Từ ${dayLabel(visiblePoints[0].day ?? "")} đến ${dayLabel(visiblePoints[visiblePoints.length - 1].day ?? "")}` : "Chưa có dữ liệu"}
          className="mt-1 block min-h-8 w-full cursor-pointer accent-primary" />
      </label>
    )}
    <p className="mt-3 text-right text-xs tabular-nums text-on-surface-variant">Đỉnh khoảng đang xem: {chartMoney.format(visiblePoints.reduce((peak, point) => Math.max(peak, point.amount), 0))}</p>
  </>;
}
