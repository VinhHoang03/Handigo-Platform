interface ServiceListToolbarProps {
  title: string;
  resultCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

/** Tiêu đề trang, ô tìm kiếm và bộ sắp xếp cho danh sách dịch vụ. */
export function ServiceListToolbar({
  title,
  resultCount,
  search,
  onSearchChange,
  sortBy,
  onSortChange,
}: ServiceListToolbarProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="text-sm font-bold uppercase text-primary">
          Dịch vụ Handigo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-on-surface">{title}</h1>
        <p className="mt-1 text-on-surface-variant">
          Hiển thị {resultCount} dịch vụ phù hợp
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm dịch vụ..."
            className="min-h-11 w-full rounded-full border border-outline-variant/40 bg-surface-container-lowest pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="min-h-11 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 text-sm font-semibold text-primary"
        >
          <option value="popular">Phổ biến nhất</option>
          <option value="price_asc">Giá thấp đến cao</option>
          <option value="name">Tên A-Z</option>
        </select>
      </div>
    </div>
  );
}
