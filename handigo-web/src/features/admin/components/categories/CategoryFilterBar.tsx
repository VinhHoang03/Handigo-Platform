import { TableToolbar } from '@/components/common/dashboard/TableToolbar';
import { Plus, RefreshCw } from "lucide-react";

interface CategoryFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;
  onRefresh: () => void;
  onCreate: () => void;
}

/** Thanh tìm kiếm + lọc trạng thái + tải lại phía trên bảng danh mục. */
export function CategoryFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, sortOrder, onSortOrderChange, onRefresh, onCreate }: CategoryFilterBarProps) {
  return (
    <TableToolbar
      search={{ value: search, onChange: onSearchChange, placeholder: 'Tìm kiếm danh mục...' }}
      filters={
        <div className="flex w-full gap-3">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Tạm ngưng</option>
          </select>
          <select
            value={sortOrder}
            onChange={(event) => onSortOrderChange(event.target.value as 'asc' | 'desc')}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
            aria-label="Sắp xếp danh mục"
          >
            <option value="asc">Tên A–Z</option>
            <option value="desc">Tên Z–A</option>
          </select>
        </div>
      }
      actions={
        <>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Tải lại"
          >
            <RefreshCw aria-hidden="true" size={24} />
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-container px-5 font-bold text-on-primary-container shadow-md transition-all hover:opacity-90 active:scale-95"
          >
            <Plus aria-hidden="true" size={20} />
            Thêm danh mục
          </button>
        </>
      }
    />
  );
}
