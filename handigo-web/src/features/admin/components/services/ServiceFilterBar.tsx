import type { Category } from '../../types/categoryService.types';
import { RefreshCw, Search } from "lucide-react";

interface ServiceFilterBarProps {
  search: string;
  onSearchDraftChange: (value: string) => void;
  onSearchCommit: () => void;
  categories: Category[];
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
}

/**
 * Thanh tìm kiếm + lọc danh mục/trạng thái phía trên danh sách dịch vụ.
 * Ô tìm kiếm chỉ đẩy giá trị lên URL khi rời focus (giữ đúng hành vi cũ).
 */
export function ServiceFilterBar({
  search,
  onSearchDraftChange,
  onSearchCommit,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  hasFilters,
  onClearFilters,
  onRefresh,
}: ServiceFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Tìm kiếm dịch vụ</span>
        <Search aria-hidden="true" size={24} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
        <input
          type="search"
          name="service-search"
          autoComplete="off"
          value={search}
          onChange={(event) => onSearchDraftChange(event.target.value)}
          onBlur={onSearchCommit}
          placeholder="Tìm kiếm dịch vụ…"
          className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low py-2.5 pl-10 pr-4 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </label>
      <label className="min-w-44">
        <span className="sr-only">Lọc theo danh mục</span>
        <select
          value={categoryFilter}
          onChange={(event) => onCategoryFilterChange(event.target.value)}
          name="service-category-filter"
          className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-2.5 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="min-w-40">
        <span className="sr-only">Lọc theo trạng thái</span>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          name="service-status-filter"
          className="min-h-11 w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-2.5 text-label-md focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Hoạt động</option>
          <option value="false">Tạm ngưng</option>
        </select>
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Xóa bộ lọc
        </button>
      )}
      <button
        type="button"
        onClick={onRefresh}
        className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label="Tải lại danh sách"
      >
        <RefreshCw aria-hidden="true" size={24} />
      </button>
    </div>
  );
}
