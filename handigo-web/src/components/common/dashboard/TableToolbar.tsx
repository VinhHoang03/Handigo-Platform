import type { ReactNode } from "react";
import { Search } from "lucide-react";

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
  fieldsClassName?: string;
  /** Hành động bên phải (nút thêm mới, xuất dữ liệu...). */
  actions?: ReactNode;
}

export function TableToolbar({ search, filters, fieldsClassName = "sm:grid-cols-2", actions }: TableToolbarProps) {
  const hasSearchOrFilters = Boolean(search || filters);

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {hasSearchOrFilters && (
          <div className={`grid min-w-0 flex-1 gap-3 ${fieldsClassName}`}>
            {search && (
              <div className="relative min-w-0">
              <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder}
                aria-label={search.placeholder || "Tìm kiếm"}
                disabled={search.disabled}
                maxLength={search.maxLength ?? 100}
                className="min-h-11 w-full rounded-xl border border-outline-variant pl-10 pr-3 disabled:bg-surface-container"
              />
              </div>
            )}
            {filters}
          </div>
        )}
        {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
      </div>
    </section>
  );
}
