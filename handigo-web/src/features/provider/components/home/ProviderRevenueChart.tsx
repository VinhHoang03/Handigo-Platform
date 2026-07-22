import { Skeleton } from "@/components/common/Skeleton";
import { formatMoney, type RevenuePeriod } from "./providerHome.utils";

interface RevenueChartItem {
  key: string;
  label: string;
  amount: number;
}

interface ProviderRevenueChartProps {
  revenuePeriod: RevenuePeriod;
  onPeriodChange: (period: RevenuePeriod) => void;
  isLoadingEarnings: boolean;
  earningsError: string | null;
  revenueChart: RevenueChartItem[];
  maxRevenue: number;
  revenueTotal: number;
  revenueLabel: string;
}

export function ProviderRevenueChart({
  revenuePeriod,
  onPeriodChange,
  isLoadingEarnings,
  earningsError,
  revenueChart,
  maxRevenue,
  revenueTotal,
  revenueLabel,
}: ProviderRevenueChartProps) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-md">
      <div className="mb-md flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="font-headline-md text-on-surface">Doanh thu</h3>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="text-sm font-bold text-primary tabular-nums">
              {formatMoney(revenueTotal)}
            </p>
            <p className="text-xs text-on-surface-variant">{revenueLabel}</p>
          </div>
          <select
            value={revenuePeriod}
            onChange={(event) =>
              onPeriodChange(event.target.value as RevenuePeriod)
            }
            aria-label="Lọc biểu đồ doanh thu"
            className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
          </select>
        </div>
      </div>
      {isLoadingEarnings ? (
        <Skeleton className="h-64 w-full" rounded="rounded-2xl" />
      ) : earningsError ? (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-error/5 px-4 text-center text-sm text-error">
          {earningsError}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            className={`relative ${revenuePeriod === "month" ? "min-w-[900px]" : "min-w-[520px]"}`}
          >
            {revenueTotal === 0 && (
              <p className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-sm font-semibold text-on-surface-variant">
                Chưa phát sinh doanh thu trong khoảng thời gian này.
              </p>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-8 top-8 flex flex-col justify-between">
              {[0, 1, 2, 3].map((line) => (
                <span
                  key={line}
                  className="block border-t border-dashed border-outline-variant/35"
                />
              ))}
            </div>
            <div className="relative z-10 flex h-64 items-end justify-between gap-1 px-sm pt-8 sm:gap-2">
              {revenueChart.map((item) => {
                const height = maxRevenue
                  ? Math.max(
                      (item.amount / maxRevenue) * 100,
                      item.amount > 0 ? 4 : 0,
                    )
                  : 0;

                return (
                  <div
                    key={item.key}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="group relative h-48 w-full rounded-t-md bg-primary-container/15"
                      title={`${item.label}: ${formatMoney(item.amount)}`}
                      aria-label={`${item.label}: ${formatMoney(item.amount)}`}
                    >
                      <div
                        className="absolute bottom-0 w-full rounded-t-md bg-primary transition-all duration-500 group-hover:bg-primary/85"
                        style={{ height: `${height}%` }}
                      />
                      <span className="pointer-events-none absolute -top-7 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-on-surface px-2 py-1 text-[10px] font-bold text-surface tabular-nums shadow-md group-hover:block">
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                    <span className="text-[11px] font-label-sm capitalize text-on-surface-variant">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
