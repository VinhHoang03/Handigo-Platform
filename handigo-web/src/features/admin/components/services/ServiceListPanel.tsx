import type { Category, Service } from '../../types/categoryService.types';
import { getCategoryId, getPriceLabel, isImageUrl } from './service.helpers';
import { SearchX, Wrench } from "lucide-react";

interface ServiceListPanelProps {
  services: Service[];
  categories: Category[];
  loading: boolean;
  selectedServiceId: string;
  hasFilters: boolean;
  onSelect: (serviceId: string) => void;
  onClearFilters: () => void;
}

/** Danh sách dịch vụ bên trái trang quản lý dịch vụ (master-detail). */
export function ServiceListPanel({ services, categories, loading, selectedServiceId, hasFilters, onSelect, onClearFilters }: ServiceListPanelProps) {
  const categoryNames = new Map(categories.map((category) => [category._id, category.name]));

  return (
    <section aria-labelledby="service-list-title" className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm xl:sticky xl:top-4">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
        <h2 id="service-list-title" className="font-bold text-on-surface">Danh sách dịch vụ</h2>
        <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant">{services.length}</span>
      </div>
      <div className="max-h-[440px] space-y-2 overflow-y-auto p-3 [overscroll-behavior:contain] xl:max-h-[calc(100dvh-280px)]">
        {loading && <div className="rounded-lg bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải…</div>}
        {!loading && services.length === 0 && (
          <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center">
            <SearchX aria-hidden="true" size={30} className="text-on-surface-variant" />
            <p className="mt-2 font-semibold text-on-surface">Không tìm thấy dịch vụ</p>
            <p className="mt-1 text-sm text-on-surface-variant">Thử thay đổi từ khóa hoặc xóa bộ lọc hiện tại.</p>
            {hasFilters && (
              <button type="button" onClick={onClearFilters} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
        {!loading &&
          services.map((service) => {
            const active = selectedServiceId === service._id;
            return (
              <button
                key={service._id}
                type="button"
                onClick={() => onSelect(service._id)}
                aria-pressed={active}
                className={`w-full touch-manipulation rounded-lg border p-3 text-left [contain-intrinsic-size:auto_90px] [content-visibility:auto] transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-surface-container-lowest hover:border-outline-variant/50 hover:bg-surface-container-low'}`}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-variant">
                    {service.image && isImageUrl(service.image) ? (
                      <img src={service.image} alt="" aria-hidden="true" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Wrench aria-hidden="true" size={24} className="flex h-full w-full items-center justify-center text-on-surface-variant" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-label-md font-bold text-on-surface">{service.name}</p>
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${service.isActive ? 'bg-success' : 'bg-outline'}`}
                        title={service.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                        aria-label={service.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-label-sm text-on-surface-variant">{categoryNames.get(getCategoryId(service)) || 'Chưa phân loại'}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-primary">{getPriceLabel(service)}</span>
                      <span className="text-on-surface-variant">{service.isActive ? 'Hoạt động' : 'Tạm ngưng'}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}
