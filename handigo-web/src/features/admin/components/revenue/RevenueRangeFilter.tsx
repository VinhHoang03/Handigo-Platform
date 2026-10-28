import { AdminDatePicker } from "../shared/AdminDatePicker";
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
    <div role="group" aria-label="Khoảng thời gian báo cáo doanh thu" className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <button key={days} type="button" onClick={() => onPreset(days)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary">
              {days} ngày
            </button>
          ))}
        </div>
        <div className="admin-date-range">
          <AdminDatePicker label="Từ ngày" compact required value={range.fromDate} max={range.toDate} onChange={value => onChange({ ...range, fromDate: value })} />
          <AdminDatePicker label="Đến ngày" compact required value={range.toDate} min={range.fromDate} onChange={value => onChange({ ...range, toDate: value })} />
        </div>
    </div>
  );
}
