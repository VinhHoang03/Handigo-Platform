import { BarChart, ChartCard, chartCompactMoney, chartMoney } from "@/components/common/chart";
import { CalendarRange } from "lucide-react";
import { useId, useState } from "react";
import {
  dateKey,
  formatRevenueWeekOption,
  getRevenueWeeksInYear,
  revenueWeekKey,
  type RevenueCustomRange,
  type RevenuePeriod,
} from "./providerHome.utils";

interface RevenueChartItem {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
}

interface ProviderRevenueChartProps {
  revenuePeriod: RevenuePeriod;
  onPeriodChange: (period: RevenuePeriod) => void;
  revenueWeek: string;
  onWeekChange: (week: string) => void;
  revenueMonth: string;
  onMonthChange: (month: string) => void;
  revenueYear: number;
  onYearChange: (year: number) => void;
  customRevenueRange: RevenueCustomRange | null;
  onCustomRangeApply: (range: RevenueCustomRange) => void;
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
  revenueWeek,
  onWeekChange,
  revenueMonth,
  onMonthChange,
  revenueYear,
  onYearChange,
  customRevenueRange,
  onCustomRangeApply,
  isLoadingEarnings,
  earningsError,
  revenueChart,
  revenueTotal,
  revenueLabel,
}: ProviderRevenueChartProps) {
  const dateFieldId = useId();
  const today = new Date();
  const todayKey = dateKey(today);
  const currentWeek = revenueWeekKey(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState(customRevenueRange?.fromDate ?? dateKey(monthStart));
  const [toDate, setToDate] = useState(customRevenueRange?.toDate ?? todayKey);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 10 }, (_, index) => currentYear - index);
  const selectedWeekYear = Number(revenueWeek.slice(0, 4));
  const selectedWeekNumber = Number(revenueWeek.slice(-2));
  const selectedMonthYear = Number(revenueMonth.slice(0, 4));
  const selectedMonthNumber = Number(revenueMonth.slice(5, 7));
  const currentWeekYear = Number(currentWeek.slice(0, 4));
  const currentWeekNumber = Number(currentWeek.slice(-2));
  const weekCount = selectedWeekYear === currentWeekYear
    ? currentWeekNumber
    : getRevenueWeeksInYear(selectedWeekYear);
  const monthCount = selectedMonthYear === currentYear ? today.getMonth() + 1 : 12;

  const changeWeekYear = (year: number) => {
    const maxWeek = year === currentWeekYear ? currentWeekNumber : getRevenueWeeksInYear(year);
    onWeekChange(`${year}-W${String(Math.min(selectedWeekNumber, maxWeek)).padStart(2, "0")}`);
  };

  const changeMonthYear = (year: number) => {
    const maxMonth = year === currentYear ? today.getMonth() + 1 : 12;
    onMonthChange(`${year}-${String(Math.min(selectedMonthNumber, maxMonth)).padStart(2, "0")}`);
  };

  const choosePeriod = (period: Exclude<RevenuePeriod, "custom">) => {
    setShowCustomRange(false);
    setRangeError(null);
    onPeriodChange(period);
  };

  const applyCustomRange = () => {
    if (!fromDate || !toDate) {
      setRangeError("Hãy chọn đủ ngày bắt đầu và ngày kết thúc.");
      return;
    }
    if (fromDate > toDate) {
      setRangeError("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
      return;
    }
    if (toDate > todayKey) {
      setRangeError("Không thể lọc thu nhập ở thời gian tương lai.");
      return;
    }

    setRangeError(null);
    setShowCustomRange(false);
    onCustomRangeApply({ fromDate, toDate });
  };

  const filterButtonClass = (active: boolean) =>
    `min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${
      active
        ? "bg-primary text-on-primary shadow-sm"
        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    }`;

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
            {chartMoney.format(revenueTotal)}
          </p>
          <p className="text-xs text-on-surface-variant">{revenueLabel}</p>
        </div>
      }
      toolbar={
        <div className="mb-5 rounded-xl border border-outline-variant/35 bg-surface-container-low/70 p-2.5">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-lowest p-1 sm:flex sm:flex-wrap"
              role="group"
              aria-label="Chọn nhanh khoảng thu nhập"
            >
              <button type="button" className={filterButtonClass(revenuePeriod === "week")} aria-pressed={revenuePeriod === "week"} onClick={() => choosePeriod("week")}>
                Theo tuần
              </button>
              <button type="button" className={filterButtonClass(revenuePeriod === "month")} aria-pressed={revenuePeriod === "month"} onClick={() => choosePeriod("month")}>
                Theo tháng
              </button>
              <button type="button" className={filterButtonClass(revenuePeriod === "year")} aria-pressed={revenuePeriod === "year"} onClick={() => choosePeriod("year")}>
                Theo năm
              </button>
              <button
                type="button"
                className={filterButtonClass(revenuePeriod === "custom" || showCustomRange)}
                aria-expanded={showCustomRange}
                aria-controls={`${dateFieldId}-custom-range`}
                onClick={() => {
                  setShowCustomRange((visible) => !visible);
                  setRangeError(null);
                }}
              >
                <span className="inline-flex items-center gap-1.5"><CalendarRange aria-hidden="true" size={16} />Khoảng ngày</span>
              </button>
            </div>

            {revenuePeriod === "week" && !showCustomRange && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm font-medium text-on-surface-variant xl:justify-start">
                <span>Tuần cần xem</span>
                <select
                  name="revenueWeek"
                  aria-label="Chọn tuần cần xem"
                  value={revenueWeek}
                  onChange={(event) => onWeekChange(event.target.value)}
                  className="min-h-10 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  {Array.from({ length: weekCount }, (_, index) => {
                    const value = `${selectedWeekYear}-W${String(index + 1).padStart(2, "0")}`;
                    return <option key={value} value={value}>{formatRevenueWeekOption(value)}</option>;
                  }).reverse()}
                </select>
                <select
                  name="revenueWeekYear"
                  aria-label="Chọn năm của tuần"
                  value={selectedWeekYear}
                  onChange={(event) => changeWeekYear(Number(event.target.value))}
                  className="min-h-10 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  {years.map((year) => <option key={year} value={year}>Năm {year}</option>)}
                </select>
              </div>
            )}

            {revenuePeriod === "month" && !showCustomRange && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm font-medium text-on-surface-variant xl:justify-start">
                <span>Tháng cần xem</span>
                <select
                  name="revenueMonth"
                  aria-label="Chọn tháng cần xem"
                  value={revenueMonth}
                  onChange={(event) => onMonthChange(event.target.value)}
                  className="min-h-10 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  {Array.from({ length: monthCount }, (_, index) => {
                    const month = index + 1;
                    const value = `${selectedMonthYear}-${String(month).padStart(2, "0")}`;
                    return <option key={value} value={value}>Tháng {month}</option>;
                  })}
                </select>
                <select
                  name="revenueMonthYear"
                  aria-label="Chọn năm của tháng"
                  value={selectedMonthYear}
                  onChange={(event) => changeMonthYear(Number(event.target.value))}
                  className="min-h-10 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  {years.map((year) => <option key={year} value={year}>Năm {year}</option>)}
                </select>
              </div>
            )}

            {revenuePeriod === "year" && !showCustomRange && (
              <label className="flex items-center justify-between gap-3 px-1 text-sm font-medium text-on-surface-variant xl:justify-start">
                Năm cần xem
                <select
                  value={revenueYear}
                  name="revenueYear"
                  autoComplete="off"
                  onChange={(event) => onYearChange(Number(event.target.value))}
                  className="min-h-10 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-semibold text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            )}
          </div>

          {showCustomRange && (
            <div id={`${dateFieldId}-custom-range`} className="mt-2.5 border-t border-outline-variant/35 px-1 pt-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="space-y-1 text-xs font-semibold text-on-surface-variant">
                  Từ ngày
                  <input
                    type="date"
                    name="revenueFromDate"
                    autoComplete="off"
                    value={fromDate}
                    max={todayKey}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="block min-h-11 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm font-medium text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-on-surface-variant">
                  Đến ngày
                  <input
                    type="date"
                    name="revenueToDate"
                    autoComplete="off"
                    value={toDate}
                    min={fromDate || undefined}
                    max={todayKey}
                    onChange={(event) => setToDate(event.target.value)}
                    className="block min-h-11 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm font-medium text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                  />
                </label>
                <button type="button" onClick={applyCustomRange} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                  Áp dụng
                </button>
              </div>
              {rangeError && <p className="mt-2 text-sm font-medium text-error" role="alert">{rangeError}</p>}
              <p className="mt-2 text-xs text-on-surface-variant">Khoảng ngắn hiển thị theo ngày; khoảng dài tự gộp theo tuần hoặc tháng.</p>
            </div>
          )}
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
