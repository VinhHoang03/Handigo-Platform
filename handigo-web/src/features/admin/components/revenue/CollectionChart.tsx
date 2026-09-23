import { BarChart, chartCompactMoney, chartMoney, dayLabel } from "@/components/common/chart";
import type { RevenueSeriesPoint } from "../../types/adminRevenue.types";

/**
 * Bản cũ đặt chiều cao cột bằng px tính tay (`(amount/max)*160`), nên biểu đồ
 * không co theo container. Nay để `ResponsiveContainer` lo phần đó.
 */
export function CollectionChart({ points }: { points: RevenueSeriesPoint[] }) {
  const visiblePoints = points.slice(-31);

  if (!visiblePoints.length) {
    return (
      <p className="py-12 text-center text-on-surface-variant">
        Chưa có giao dịch thu tiền trong kỳ.
      </p>
    );
  }

  return (
    <BarChart
      data={visiblePoints.map((point) => ({
        label: dayLabel(point.day ?? ""),
        fullLabel: point.day ?? "",
        value: point.amount,
      }))}
      ariaLabel="Dòng tiền thu theo ngày"
      height={240}
      singleColor
      formatValue={(value) => chartMoney.format(value)}
      formatAxisValue={(value) => chartCompactMoney.format(value)}
    />
  );
}
