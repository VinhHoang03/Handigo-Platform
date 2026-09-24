import { CategoryIcon } from '@/components/common/CategoryIcon';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Category } from '../../types/categoryService.types';
import { ChevronRight, RefreshCw } from "lucide-react";

interface CategoryListPanelProps {
  categories: Category[];
  serviceCounts: Record<string, number>;
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

/** Danh sách danh mục bên trái trang quản lý danh mục & dịch vụ. */
export function CategoryListPanel({ categories, serviceCounts, loading, selectedId, onSelect, onRefresh }: CategoryListPanelProps) {
  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-headline-md font-bold">Danh mục dịch vụ</h2>
          <p className="text-sm text-on-surface-variant">{categories.length} danh mục</p>
        </div>
        <button onClick={onRefresh} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low" aria-label="Tải lại">
          <RefreshCw aria-hidden="true" size={24} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {loading && <div className="rounded-xl bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải danh mục...</div>}
        {!loading && categories.length === 0 && (
          <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có danh mục phù hợp.</div>
        )}
        {!loading &&
          categories.map((category) => {
            const active = category._id === selectedId;
            return (
              <button
                key={category._id}
                onClick={() => onSelect(category._id)}
                className={`group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50'}`}
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                    <CategoryIcon icon={category.icon} name={category.name} className="h-7 w-7" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate font-semibold ${active ? 'text-primary' : ''}`}>{category.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span>{serviceCounts[category._id] || 0} dịch vụ</span>
                      <span className="h-1 w-1 rounded-full bg-outline-variant" />
                      <StatusBadge value={category.isActive ? 'active' : 'hidden'} />
                    </span>
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={20} className="text-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
      </div>
    </section>
  );
}
