import { RefreshCw } from "lucide-react";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import type { SuggestionStatus, SuggestionType } from "../types/serviceSuggestion.types";

interface SuggestionListHeaderProps {
  status: SuggestionStatus | "";
  onStatusChange: (value: SuggestionStatus | "") => void;
  suggestionType: SuggestionType | "";
  onSuggestionTypeChange: (value: SuggestionType | "") => void;
  count: number;
  onRefresh: () => void;
}

/** Tiêu đề trang + bộ lọc trạng thái/loại đề xuất, tách khỏi trang chính để giữ dưới 200 dòng. */
export function SuggestionListHeader({
  status,
  onStatusChange,
  suggestionType,
  onSuggestionTypeChange,
  count,
  onRefresh,
}: SuggestionListHeaderProps) {
  return (
    <>
      <header className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-primary">Đề xuất từ provider</p>
          <h1 className="mt-2 text-2xl font-bold text-on-surface">
            Quản lý đề xuất service và category
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 font-bold text-on-surface-variant hover:text-primary"
          onClick={onRefresh}
        >
          <RefreshCw size={18} />
          Tải lại
        </button>
      </header>

      <TableToolbar
        filters={
          <>
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as SuggestionStatus | "")}
              className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
            <select
              value={suggestionType}
              onChange={(event) => onSuggestionTypeChange(event.target.value as SuggestionType | "")}
              className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
            >
              <option value="">Tất cả loại đề xuất</option>
              <option value="service">Service</option>
              <option value="category">Category</option>
            </select>
          </>
        }
        actions={
          <div className="flex items-center rounded-lg bg-surface-container-low px-4 py-2.5 text-sm font-medium text-on-surface-variant">
            {count} đề xuất
          </div>
        }
      />
    </>
  );
}
