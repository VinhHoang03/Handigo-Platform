import { CategoryIcon } from '@/components/common/CategoryIcon';
import type { Category } from '../../../types/booking';
import { ArrowRight } from "lucide-react";

interface CategoryQuickSelectProps {
  categories: Category[];
  categoryId?: string;
  onSelect: (categoryId: string) => void;
  onOpenMore: () => void;
}

export const CategoryQuickSelect = ({ categories, categoryId, onSelect, onOpenMore }: CategoryQuickSelectProps) => (
  <div className="grid grid-cols-6 gap-sm">
    {categories.map((cat) => (
      <button
        key={cat._id}
        onClick={() => onSelect(cat._id)}
        className={`group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 bg-surface-container-lowest px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-md ${categoryId === cat._id ? 'border-primary bg-surface-container-low shadow-primary/10' : 'border-outline-variant/30'
        }`}
      >
        <div className="mb-2 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
          <CategoryIcon
            icon={cat.icon}
            name={cat.name}
            className="h-6 w-6 text-primary"
            imageClassName="h-7 w-7 object-contain"
          />
        </div>
        <span className="line-clamp-2 text-label-sm font-bold leading-snug text-on-surface">{cat.name}</span>
      </button>
    ))}
    <button
      type="button"
      onClick={onOpenMore}
      disabled={categories.length === 0}
      className="group flex min-h-[104px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container-low px-2 py-3 text-center text-on-surface-variant transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:disabled:hover:border-outline-variant/60 disabled:hover:bg-surface-container-low disabled:hover:text-on-surface-variant"
    >
      <ArrowRight aria-hidden="true" size={30} className="mb-2 transition-transform group-hover:translate-x-0.5" />
      <span className="text-label-sm font-bold">Thêm</span>
    </button>
  </div>
);
