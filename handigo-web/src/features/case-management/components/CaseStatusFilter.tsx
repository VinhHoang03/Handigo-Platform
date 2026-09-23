import { CASE_STATUS_OPTIONS, STATUS_LABELS } from "./caseStatusLabels.constants";
import type { CaseTab } from "./caseTabs.constants";

interface CaseStatusFilterProps {
  tab: CaseTab;
  value: string;
  onChange: (status: string) => void;
}

export function CaseStatusFilter({ tab, value, onChange }: CaseStatusFilterProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
      <label className="text-sm font-semibold">
        Trạng thái
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="ml-3 min-h-11 rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="">Tất cả</option>
          {CASE_STATUS_OPTIONS[tab].map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
