import { CalendarDays } from "lucide-react";
import { toInputDate } from "./revenue-format";
import type { RevenueQuery } from "../../types/adminRevenue.types";

export function RevenueRangeFilter({
  range,
  onPreset,
  onChange,
}: {
  range: RevenueQuery;
  onPreset: (days: number) => void;
  onChange: (range: RevenueQuery) => void;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <button key={days} type="button" onClick={() => onPreset(days)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary">
              {days} ngày
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <label className="text-sm font-semibold text-on-surface">
            Từ ngày
            <span className="relative mt-1 block">
              <CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
              <input type="date" value={range.fromDate} max={range.toDate} onChange={(event) => onChange({ ...range, fromDate: event.target.value })} className="min-h-10 rounded-lg border border-outline-variant bg-surface pl-9 pr-3 font-normal" />
            </span>
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Đến ngày
            <span className="relative mt-1 block">
              <CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
              <input type="date" value={range.toDate} min={range.fromDate} max={toInputDate(new Date())} onChange={(event) => onChange({ ...range, toDate: event.target.value })} className="min-h-10 rounded-lg border border-outline-variant bg-surface pl-9 pr-3 font-normal" />
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
