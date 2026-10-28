import { SeriesChartView, chartCompactMoney, chartMoney, dayLabel } from "@/components/common/chart";
import type { RevenueSeriesPoint } from "../../types/adminRevenue.types";

export function CollectionChart({ points, type = "bar" }: { points: RevenueSeriesPoint[]; type?: string }) {
  const visiblePoints = points.slice(-31);
  return <>
    <SeriesChartView title="Dòng tiền thu theo ngày" type={type} xKey="day"
      data={visiblePoints.map((point) => ({ day: point.day ?? "", amount: point.amount }))}
      series={[{ dataKey: "amount", name: "Tiền thu" }]} formatX={dayLabel}
      formatValue={(value) => chartMoney.format(value)} formatY={(value) => chartCompactMoney.format(value)} />
    <p className="mt-3 text-right text-xs tabular-nums text-on-surface-variant">Đỉnh kỳ: {chartMoney.format(Math.max(...visiblePoints.map((point) => point.amount), 0))}</p>
  </>;
}
