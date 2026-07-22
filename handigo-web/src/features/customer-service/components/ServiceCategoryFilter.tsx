import { ReliableImage } from "@/components/common/ReliableImage";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { Category } from "@/types/booking";

interface ServiceCategoryFilterProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  /** Số dịch vụ theo từng `categoryId`, đếm từ dữ liệu đã tải. */
  serviceCounts: Record<string, number>;
  totalCount: number;
}

/**
 * Sidebar bộ lọc danh mục dịch vụ.
 *
 * Chỉ hiện danh mục **đang có dịch vụ**. DB có 11 danh mục nhưng 4 trong số đó
 * chưa có dịch vụ nào; bấm vào chỉ ra danh sách trắng, tức là mời người dùng đi
 * vào ngõ cụt. Số dịch vụ in kèm để biết trước sẽ thấy bao nhiêu kết quả.
 */
export function ServiceCategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
  serviceCounts,
  totalCount,
}: ServiceCategoryFilterProps) {
  const visibleCategories = categories.filter(
    (category) => (serviceCounts[category._id] || 0) > 0,
  );

  return (
    <aside className="md:sticky md:top-32 md:col-span-1 md:self-start">
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm md:max-h-[calc(100vh-9rem)] md:overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Bộ lọc</h2>
          <span className="material-symbols-outlined text-on-surface-variant">
            tune
          </span>
        </div>

        <div className="space-y-2">
          <p className="mb-3 text-xs font-bold uppercase text-on-surface-variant">
            Danh mục
          </p>
          <button
            type="button"
            onClick={() => onSelect("")}
            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              !selectedCategoryId
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              apps
            </span>
            <span className="flex-1">Tất cả dịch vụ</span>
            <span className="text-xs tabular-nums opacity-70">{totalCount}</span>
          </button>
          {visibleCategories.map((category) => {
            const categoryImage = category.image;

            return (
              <button
                key={category._id}
                type="button"
                onClick={() => onSelect(category._id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                  selectedCategoryId === category._id
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                {categoryImage ? (
                  <ReliableImage
                    src={categoryImage.replace(
                      /^http:\/\/res\.cloudinary\.com/i,
                      "https://res.cloudinary.com",
                    )}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <CategoryIcon
                    icon={category.icon}
                    name={category.name}
                    className="h-5 w-5 shrink-0"
                  />
                )}
                <span className="flex-1">{category.name}</span>
                <span className="text-xs tabular-nums opacity-70">
                  {serviceCounts[category._id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
