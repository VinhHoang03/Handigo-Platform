import { SearchX } from "lucide-react";

interface ServiceListEmptyProps {
  search: string;
  categoryName?: string;
  onClearSearch: () => void;
  onClearCategory: () => void;
}

/**
 * Trạng thái rỗng của danh sách dịch vụ.
 *
 * Trước đây chỗ này chỉ có một dòng "Chưa có dịch vụ phù hợp.", đúng nhưng vô
 * dụng: người dùng không biết mình đang lọc theo gì và cũng không có đường lùi.
 * Nêu rõ điều kiện đang áp và cho nút gỡ từng điều kiện một.
 */
export function ServiceListEmpty({
  search,
  categoryName,
  onClearSearch,
  onClearCategory,
}: ServiceListEmptyProps) {
  const hasSearch = Boolean(search.trim());

  return (
    <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-10 text-center">
      <span className="grid h-14 w-14 place-items-center justify-self-center rounded-2xl bg-surface-container text-on-surface-variant">
        <SearchX aria-hidden="true" size={24} />
      </span>

      <p className="mt-5 text-lg font-semibold text-on-surface">
        Không tìm thấy dịch vụ nào
      </p>

      <p className="mx-auto mt-2 max-w-[46ch] text-pretty text-on-surface-variant">
        {hasSearch && categoryName
          ? `Đang tìm "${search.trim()}" trong danh mục ${categoryName}.`
          : hasSearch
            ? `Đang tìm "${search.trim()}" trong tất cả dịch vụ.`
            : `Danh mục ${categoryName} chưa có dịch vụ nào.`}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasSearch && (
          <button type="button" onClick={onClearSearch} className="btn-secondary">
            Xoá từ khoá
          </button>
        )}
        {categoryName && (
          <button type="button" onClick={onClearCategory} className="btn-primary">
            Xem tất cả dịch vụ
          </button>
        )}
      </div>
    </div>
  );
}
