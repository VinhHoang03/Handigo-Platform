import { AdminPageTitle, AdminRefreshButton } from "@/features/admin/components/shared/AdminPageHeader";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import type { SuggestionStatus, SuggestionType } from "../types/serviceSuggestion.types";

interface SuggestionListHeaderProps {
  status: SuggestionStatus | "";
  onStatusChange: (value: SuggestionStatus | "") => void;
  suggestionType: SuggestionType | "";
  onSuggestionTypeChange: (value: SuggestionType | "") => void;
  count: number;
  onRefresh: () => void;
  loading: boolean;
}

/** Tiêu đề trang + bộ lọc trạng thái/loại đề xuất, tách khỏi trang chính để giữ dưới 200 dòng. */
export function SuggestionListHeader({
  status,
  onStatusChange,
  suggestionType,
  onSuggestionTypeChange,
  count,
  onRefresh,
  loading,
}: SuggestionListHeaderProps) {
  return (
    <>
      <header className="admin-page-header">
        <div>
          <AdminPageTitle title="Quản lý đề xuất dịch vụ và danh mục" />
        </div>
        <AdminRefreshButton onRefresh={onRefresh} loading={loading} />
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
              <option value="service">Dịch vụ</option>
              <option value="category">Danh mục</option>
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
