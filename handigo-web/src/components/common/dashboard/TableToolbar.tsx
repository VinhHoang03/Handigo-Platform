import type { ReactNode } from "react";

/**
 * Thanh công cụ phía trên bảng admin: ô tìm kiếm + khe cắm bộ lọc + khe cắm
 * hành động (ví dụ nút "Thêm mới", hành động hàng loạt). Mọi khe đều tùy
 * chọn — trang không cần tìm kiếm thì bỏ qua `search`.
 */
interface TableToolbarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

interface TableToolbarProps {
  search?: TableToolbarSearch;
  /** Bộ lọc bổ sung (select trạng thái, khoảng ngày...). */
  filters?: ReactNode;
  /** Hành động bên phải (nút thêm mới, xuất dữ liệu...). */
  actions?: ReactNode;
}

export function TableToolbar({ search, filters, actions }: TableToolbarProps) {
  const hasSearchOrFilters = Boolean(search || filters);

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {hasSearchOrFilters && (
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {search && (
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder}
                disabled={search.disabled}
                maxLength={search.maxLength ?? 100}
                className="min-h-11 rounded-xl border border-outline-variant px-3 disabled:bg-surface-container"
              />
            )}
            {filters}
          </div>
        )}
        {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
      </div>
    </section>
  );
}
