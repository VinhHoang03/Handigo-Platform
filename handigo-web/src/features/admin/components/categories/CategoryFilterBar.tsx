import { TableToolbar } from '@/components/common/dashboard/TableToolbar';

interface CategoryFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
}

/** Thanh tìm kiếm + lọc trạng thái + tải lại phía trên bảng danh mục. */
export function CategoryFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, onRefresh }: CategoryFilterBarProps) {
  return (
    <TableToolbar
      search={{ value: search, onChange: onSearchChange, placeholder: 'Tìm kiếm danh mục...' }}
      filters={
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Hoạt động</option>
          <option value="false">Tạm ngưng</option>
        </select>
      }
      actions={
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high"
          aria-label="Tải lại"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      }
    />
  );
}
