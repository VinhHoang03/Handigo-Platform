import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { PublicProviderProfile } from "../api/customerService.api";

interface ProviderCategoriesPanelProps {
  categories: PublicProviderProfile["provider"]["serviceCategories"];
}

/** Danh mục dịch vụ mà thợ đăng ký, mở rộng để xem dịch vụ con. */
export function ProviderCategoriesPanel({
  categories,
}: ProviderCategoriesPanelProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="text-xl font-bold text-on-background">
        Danh mục dịch vụ
      </h3>
      <div className="mt-4 space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            tabIndex={0}
            className="group rounded-xl border border-outline-variant/30 bg-surface-container-lowest outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <CategoryIcon
                  icon={category.icon}
                  name={category.name}
                  className="h-5 w-5"
                />
              </span>
              <span className="min-w-0 flex-1 font-bold text-on-surface">
                {category.name}
              </span>
              <span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:rotate-180 group-focus:rotate-180">
                expand_more
              </span>
            </div>
            <div className="grid grid-rows-[0fr] transition-all duration-200 group-hover:grid-rows-[1fr] group-focus:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <ul className="space-y-2 border-t border-outline-variant/20 px-4 py-3">
                  {category.services.map((service) => (
                    <li
                      key={service.id}
                      className="flex items-start gap-2 text-sm text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">
                        check_circle
                      </span>
                      {service.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
            Chuyên gia chưa đăng ký danh mục dịch vụ.
          </p>
        )}
      </div>
    </section>
  );
}
