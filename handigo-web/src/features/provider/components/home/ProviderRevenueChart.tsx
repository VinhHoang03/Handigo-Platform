import { BarChart, ChartCard, chartCompactMoney, chartMoney } from "@/components/common/chart";
import type { RevenuePeriod } from "./providerHome.utils";

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
  revenueTotal: number;
  revenueLabel: string;
}

/**
 * Consumer thứ hai của wrapper chart, ở ngữ cảnh khác admin: cột hẹp hơn, có bộ
 * lọc tuần/tháng riêng. Bản cũ tự tính chiều cao cột theo phần trăm và tự vẽ
 * lưới bằng `<span>` gạch đứt.
 */
export function ProviderRevenueChart({
  revenuePeriod,
  onPeriodChange,
  isLoadingEarnings,
  earningsError,
  revenueChart,
  revenueTotal,
  revenueLabel,
}: ProviderRevenueChartProps) {
  return (
    <ChartCard
      title="Doanh thu"
      loading={isLoadingEarnings}
      error={earningsError || undefined}
      isEmpty={revenueTotal === 0}
      emptyMessage="Chưa phát sinh doanh thu trong khoảng thời gian này."
      height={256}
      action={
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="text-sm font-bold text-primary tabular-nums">
              {chartMoney.format(revenueTotal)}
            </p>
            <p className="text-xs text-on-surface-variant">{revenueLabel}</p>
          </div>
          <select
            value={revenuePeriod}
            onChange={(event) => onPeriodChange(event.target.value as RevenuePeriod)}
            aria-label="Lọc biểu đồ doanh thu"
            className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
          </select>
        </div>
      }
    >
      <BarChart
        data={revenueChart.map((item) => ({ label: item.label, value: item.amount }))}
        ariaLabel={`Doanh thu ${revenueLabel}`}
        height={256}
        singleColor
        formatValue={(value) => chartMoney.format(value)}
        formatAxisValue={(value) => chartCompactMoney.format(value)}
      />
    </ChartCard>
  );
}
