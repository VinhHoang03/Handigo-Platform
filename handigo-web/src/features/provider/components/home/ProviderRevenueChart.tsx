import { BarChart, ChartCard, chartCompactMoney, chartMoney } from "@/components/common/chart";
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RevenueMonthPicker } from './RevenueMonthPicker';
import { getRevenueSelection, getRevenueToday, moveRevenuePeriod, parseRevenueSelection, type RevenuePeriod } from "./providerHome.utils";

interface RevenueChartItem {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
}

interface ProviderRevenueChartProps {
  revenuePeriod: RevenuePeriod;
  onPeriodChange: (period: RevenuePeriod) => void;
  revenueAnchor: string;
  onAnchorChange: (anchor: string) => void;
  isLoadingEarnings: boolean;
  earningsError: string | null;
  revenueChart: RevenueChartItem[];
  revenueTotal: number;
  revenueLabel: string;
}

/** Biểu đồ thu nhập và bộ chọn kỳ lịch sử của thợ. */
export function ProviderRevenueChart({
  revenuePeriod,
  onPeriodChange,
  revenueAnchor,
  onAnchorChange,
  isLoadingEarnings,
  earningsError,
  revenueChart,
  revenueTotal,
  revenueLabel,
}: ProviderRevenueChartProps) {
  const [today] = useState(getRevenueToday);
  const selection = getRevenueSelection(revenuePeriod, revenueAnchor);
  const maxSelection = getRevenueSelection(revenuePeriod, today);
  const minSelection = getRevenueSelection(revenuePeriod, '2025-01-01');
  const selectPeriod = (value: string) => {
    const anchor = parseRevenueSelection(revenuePeriod, value);
    if (anchor && value <= maxSelection) onAnchorChange(anchor);
  };
  const move = (step: number) => {
    const anchor = moveRevenuePeriod(revenuePeriod, revenueAnchor, step);
    const nextSelection = getRevenueSelection(revenuePeriod, anchor);
    if (nextSelection >= minSelection && nextSelection <= maxSelection) onAnchorChange(anchor);
  };
  const controlClass = 'h-9 min-w-0 rounded-md bg-transparent px-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-30 sm:h-8';
  return (
    <ChartCard
      title="Thu nhập"
      loading={isLoadingEarnings}
      error={earningsError || undefined}
      isEmpty={revenueTotal === 0}
      emptyMessage="Chưa phát sinh thu nhập trong khoảng thời gian này."
      height={256}
      action={
          <div className="text-right">
            <p className="text-sm font-bold text-primary tabular-nums">
              {isLoadingEarnings ? 'Đang tải…' : earningsError ? 'Chưa tải được' : chartMoney.format(revenueTotal)}
            </p>
            <p className="text-xs text-on-surface-variant">{revenueLabel}</p>
          </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" role="group" aria-label="Bộ lọc doanh thu">
          <div role="group" aria-label="Lọc biểu đồ doanh thu" className="inline-flex shrink-0 gap-0.5 rounded-lg bg-surface-container-low p-0.5">
            {(['week', 'month', 'year'] as const).map(period => <button key={period} type="button" aria-pressed={period === revenuePeriod}
              onClick={() => {
              if (getRevenueSelection(period, revenueAnchor) < getRevenueSelection(period, '2025-01-01')) onAnchorChange('2025-01-01');
              onPeriodChange(period);
              }} className={`h-9 rounded-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-7 ${period === revenuePeriod ? 'bg-surface font-semibold text-primary shadow-[0_1px_3px_rgb(0_0_0/0.08)]' : 'font-medium text-on-surface-variant hover:text-on-surface'}`}>
                {period === 'week' ? 'Tuần' : period === 'month' ? 'Tháng' : 'Năm'}
              </button>)}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
          {revenuePeriod === 'year' ? <select aria-label="Chọn năm doanh thu" value={selection}
            onChange={event => selectPeriod(event.target.value)} className={`${controlClass} border border-outline-variant/40 bg-surface tabular-nums`}>
            {Array.from({ length: Number(today.slice(0, 4)) - 2024 }, (_, index) => String(Number(today.slice(0, 4)) - index))
              .map(year => <option key={year} value={year}>{year}</option>)}
          </select> : revenuePeriod === 'month' ? <RevenueMonthPicker value={selection} max={maxSelection} onChange={selectPeriod} /> : <input type="week" value={selection}
            min={minSelection} max={maxSelection}
            aria-label={revenuePeriod === 'week' ? 'Chọn tuần doanh thu' : 'Chọn tháng doanh thu'}
            onChange={event => selectPeriod(event.target.value)} className={`${controlClass} w-[150px] max-w-full border border-outline-variant/40 bg-surface`} />}
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-outline-variant/40" />
            <button type="button" onClick={() => move(-1)} disabled={selection <= minSelection} className={`${controlClass} flex w-8 items-center justify-center !px-0`} aria-label="Kỳ trước"><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => onAnchorChange(getRevenueToday())} disabled={selection === maxSelection} className={controlClass}>Hiện tại</button>
            <button type="button" onClick={() => move(1)} disabled={selection >= maxSelection} className={`${controlClass} flex w-8 items-center justify-center !px-0`} aria-label="Kỳ sau"><ChevronRight size={14} /></button>
          </div>
        </div>
      }
    >
      <BarChart
        data={revenueChart.map((item) => ({ label: item.label, fullLabel: item.fullLabel, value: item.amount }))}
        ariaLabel={`Doanh thu ${revenueLabel}`}
        height={256}
        singleColor
        barCategoryGap="28%"
        connectTops
        formatValue={(value) => chartMoney.format(value)}
        formatAxisValue={(value) => chartCompactMoney.format(value)}
      />
    </ChartCard>
  );
}
