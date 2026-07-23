import { useEffect, useRef } from "react";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { MaterialIcon } from "@/components/common/MaterialIcon";
import type { Category } from "@/types/booking";

interface ServiceFilterSheetProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  serviceCounts: Record<string, number>;
  totalCount: number;
}

/**
 * Bộ lọc danh mục cho màn hình hẹp, dạng tấm trượt từ đáy.
 *
 * Trước đây sidebar lọc đổ thẳng vào luồng trang ở mobile: người dùng phải cuộn
 * qua 11 nút danh mục mới nhìn thấy dịch vụ đầu tiên.
 *
 * Dùng `<dialog>` gốc của trình duyệt thay vì tự dựng overlay: `showModal()` lo
 * sẵn bẫy focus, phím Esc và lớp nền chặn tương tác, không cần viết tay.
 */
export function ServiceFilterSheet({
  open,
  onClose,
  categories,
  selectedCategoryId,
  onSelect,
  serviceCounts,
  totalCount,
}: ServiceFilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const visibleCategories = categories.filter(
    (category) => (serviceCounts[category._id] || 0) > 0,
  );

  const pick = (categoryId: string) => {
    onSelect(categoryId);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // Bấm ra ngoài tấm trượt thì đóng. `<dialog>` nhận click cả ở vùng nền.
        if (event.target === dialogRef.current) onClose();
      }}
      aria-label="Lọc theo danh mục"
      className="m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-3xl bg-surface-container-lowest p-0 backdrop:bg-on-surface/40 md:hidden"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/40 px-5 py-4">
        <h2 className="text-lg font-bold text-on-surface">Danh mục</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bộ lọc"
          className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-container-low"
        >
          <MaterialIcon>close</MaterialIcon>
        </button>
      </div>

      <div className="max-h-[60dvh] space-y-1 overflow-y-auto p-4">
        <FilterRow
          active={!selectedCategoryId}
          count={totalCount}
          onClick={() => pick("")}
        >
          <MaterialIcon className="text-[20px]">
            apps
          </MaterialIcon>
          Tất cả dịch vụ
        </FilterRow>

        {visibleCategories.map((category) => (
          <FilterRow
            key={category._id}
            active={selectedCategoryId === category._id}
            count={serviceCounts[category._id]}
            onClick={() => pick(category._id)}
          >
            <CategoryIcon
              icon={category.icon}
              name={category.name}
              className="h-5 w-5 shrink-0"
            />
            {category.name}
          </FilterRow>
        ))}
      </div>
    </dialog>
  );
}

const FilterRow = ({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold ${
      active
        ? "bg-primary text-on-primary"
        : "text-on-surface hover:bg-surface-container-low"
    }`}
  >
    <span className="flex flex-1 items-center gap-3">{children}</span>
    <span className="text-xs tabular-nums opacity-70">{count}</span>
  </button>
);
