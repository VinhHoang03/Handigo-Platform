import type { ServiceSortKey } from "../hooks/useServiceCatalog";
import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";

interface ServiceListToolbarProps {
  title: string;
  resultCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: ServiceSortKey;
  onSortChange: (value: ServiceSortKey) => void;
  /** Số bộ lọc đang bật, hiện trên nút mở tấm trượt ở màn hình hẹp. */
  activeFilterCount: number;
  onOpenFilters: () => void;
  isLoading: boolean;
}

/**
 * Tiêu đề trang, ô tìm kiếm và bộ sắp xếp.
 *
 * Ô tìm kiếm nay chiếm cả một hàng riêng thay vì nép bên phải tiêu đề: đây là
 * việc chính người dùng tới trang này để làm.
 *
 * Mục sắp xếp "Phổ biến nhất" đã gỡ. Nó trả `return 0`, tức là chọn xong danh
 * sách vẫn nguyên thứ tự cũ, và API dịch vụ không có trường lượt đặt nào để nối
 * vào. Một mục sắp xếp không sắp xếp gì thì thà không có.
 */
export function ServiceListToolbar({
  title,
  resultCount,
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  activeFilterCount,
  onOpenFilters,
  isLoading,
}: ServiceListToolbarProps) {
  return (
    <div className="mb-6">
      <h1 className="text-balance text-3xl font-bold text-on-surface">
        {title}
      </h1>
      {/* Khi đang tải thì chưa biết có bao nhiêu kết quả. In "0 dịch vụ" lúc đó
          đọc như là không tìm thấy gì, trong khi thật ra dữ liệu chưa về. */}
      <p className="mt-1 text-on-surface-variant">
        {isLoading
          ? "Đang tải dịch vụ..."
          : `${resultCount} dịch vụ${search.trim() ? ` khớp "${search.trim()}"` : ""}`}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search aria-hidden="true" size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Bạn cần sửa gì?"
            aria-label="Tìm dịch vụ"
            className="min-h-14 w-full rounded-full border border-outline-variant/50 bg-surface-container-lowest pl-12 pr-14 text-body-md outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Xoá từ khoá"
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <X aria-hidden="true" size={20} />
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onOpenFilters}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface md:hidden"
          >
            <SlidersHorizontal aria-hidden="true" size={20} />
            Danh mục
            {activeFilterCount > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary">
                {activeFilterCount}
              </span>
            )}
          </button>

          <label className="flex min-h-14 flex-1 items-center gap-2 whitespace-nowrap rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 sm:flex-none">
            <span className="sr-only">Sắp xếp theo</span>
            <ArrowUpDown aria-hidden="true" size={20} className="text-on-surface-variant" />
            <select
              value={sortBy}
              onChange={(event) =>
                onSortChange(event.target.value as ServiceSortKey)
              }
              className="min-h-11 cursor-pointer appearance-none bg-transparent pr-1 text-sm font-semibold text-on-surface outline-none"
            >
              <option value="name">Tên A-Z</option>
              <option value="price_asc">Giá thấp đến cao</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
