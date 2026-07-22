import { money } from "./revenue-format";
import type { RevenueSeriesPoint } from "../../types/adminRevenue.types";

export function CollectionChart({ points }: { points: RevenueSeriesPoint[] }) {
  const visiblePoints = points.slice(-31);
  const maxAmount = Math.max(...visiblePoints.map((point) => point.amount), 1);

  if (!visiblePoints.length) {
    return <p className="py-12 text-center text-on-surface-variant">Chưa có giao dịch thu tiền trong kỳ.</p>;
  }

  return (
    <div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-outline-variant/50 px-1 pt-8">
      {visiblePoints.map((point) => (
        <div key={point.day} className="group flex min-w-3 flex-1 flex-col items-center justify-end">
          <span className="mb-1 hidden whitespace-nowrap rounded bg-on-surface px-2 py-1 text-xs tabular-nums text-surface group-hover:block">
            {point.day}: {money.format(point.amount)}
          </span>
          <div
            className="w-full min-w-2 rounded-t bg-primary/75 transition group-hover:bg-primary"
            style={{ height: Math.max((point.amount / maxAmount) * 160, 3) }}
            aria-label={(point.day ?? "") + ": " + money.format(point.amount)}
          />
        </div>
      ))}
    </div>
  );
}
