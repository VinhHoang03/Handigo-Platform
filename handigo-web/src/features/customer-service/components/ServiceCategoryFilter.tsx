import { ReliableImage } from "@/components/common/ReliableImage";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { Category } from "@/types/booking";

interface ServiceCategoryFilterProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}

/** Sidebar bộ lọc danh mục dịch vụ, dùng ở trang danh sách dịch vụ khách hàng. */
export function ServiceCategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
}: ServiceCategoryFilterProps) {
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
          <p className="mb-3 text-xs font-bold uppercase text-outline">
            Danh mục
          </p>
          <button
            type="button"
            onClick={() => onSelect("")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              !selectedCategoryId
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              apps
            </span>
            Tất cả dịch vụ
          </button>
          {categories.map((category) => {
            const categoryImage = category.image;

            return (
              <button
                key={category._id}
                type="button"
                onClick={() => onSelect(category._id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
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
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
