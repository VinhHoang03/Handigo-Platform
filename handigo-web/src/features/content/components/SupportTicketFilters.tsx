import type { CaseListQuery } from "@/features/case-management/types/caseManagement.types";
import { TICKET_STATUS_LABELS } from "../data/supportData";

const fieldClasses =
  "min-h-11 w-full rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

/**
 * Bộ lọc danh sách yêu cầu hỗ trợ. Từ khoá chỉ áp dụng khi bấm "Lọc", nên có
 * dòng nhắc khi người dùng đã gõ nhưng chưa áp dụng — tránh hiểu nhầm là danh
 * sách đã được lọc.
 */
export function SupportTicketFilters({
  searchInput,
  onSearchInputChange,
  ticketQuery,
  onQueryChange,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  ticketQuery: CaseListQuery;
  onQueryChange: (updater: (current: CaseListQuery) => CaseListQuery) => void;
}) {
  const hasPendingSearch = searchInput.trim() !== (ticketQuery.keyword || "");

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <label className="text-sm font-semibold text-on-surface">
          Tìm theo tiêu đề hoặc nội dung
          <div className="mt-2 flex gap-2">
            <input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="Nhập từ khóa cần tìm"
              className={fieldClasses}
            />
            <button
              type="button"
              onClick={() =>
                onQueryChange((current) => ({
                  ...current,
                  page: 1,
                  keyword: searchInput.trim() || undefined,
                }))
              }
              className="btn-secondary min-h-11 shrink-0"
            >
              Lọc
            </button>
          </div>
        </label>

        <label className="text-sm font-semibold text-on-surface">
          Trạng thái
          <select
            value={ticketQuery.status || ""}
            onChange={(event) =>
              onQueryChange((current) => ({
                ...current,
                page: 1,
                status: event.target.value || undefined,
              }))
            }
            className={`mt-2 ${fieldClasses}`}
          >
            <option value="">Tất cả</option>
            {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasPendingSearch && (
        <p className="text-sm text-on-surface-variant">
          Có thay đổi từ khóa tìm kiếm chưa áp dụng. Chọn <b>Lọc</b> để cập nhật
          danh sách.
        </p>
      )}
    </>
  );
}
