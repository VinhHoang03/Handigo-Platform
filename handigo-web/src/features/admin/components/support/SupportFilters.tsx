import { Search } from "lucide-react";
import type { FormEvent } from "react";
import type { SupportTicketQuery } from "../../types/adminSupport.types";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "./support.constants";

interface SupportFiltersProps {
  query: SupportTicketQuery;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent) => void;
  onFilterChange: <K extends keyof SupportTicketQuery>(key: K, value: SupportTicketQuery[K]) => void;
}

const selectClass = "min-h-11 rounded-xl border border-outline-variant bg-surface px-3";

export function SupportFilters({ query, searchInput, onSearchInputChange, onSubmitSearch, onFilterChange }: SupportFiltersProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <form onSubmit={onSubmitSearch} className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Tìm kiếm yêu cầu hỗ trợ</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
          <input
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            maxLength={100}
            placeholder="Tìm theo tiêu đề hoặc nội dung..."
            className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-3"
          />
        </label>
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-on-primary">Tìm</button>
      </form>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <select value={query.status ?? ""} onChange={(event) => onFilterChange("status", event.target.value as SupportTicketQuery["status"])} className={selectClass}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={query.category ?? ""} onChange={(event) => onFilterChange("category", event.target.value as SupportTicketQuery["category"])} className={selectClass}>
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={query.priority ?? ""} onChange={(event) => onFilterChange("priority", event.target.value as SupportTicketQuery["priority"])} className={selectClass}>
          <option value="">Tất cả mức ưu tiên</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={query.assignment ?? ""} onChange={(event) => onFilterChange("assignment", event.target.value as SupportTicketQuery["assignment"])} className={selectClass}>
          <option value="">Tất cả phân công</option>
          <option value="unassigned">Chưa phân công</option>
          <option value="assigned">Đã phân công</option>
        </select>
      </div>
    </section>
  );
}
