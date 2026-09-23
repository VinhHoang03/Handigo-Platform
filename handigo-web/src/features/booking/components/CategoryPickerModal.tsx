import { Modal } from '@/components/common/Modal';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import type { Category } from '../../../types/booking';

interface CategoryPickerModalProps {
  open: boolean;
  categories: Category[];
  categoryId?: string;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

export const CategoryPickerModal = ({ open, categories, categoryId, onSelect, onClose }: CategoryPickerModalProps) => (
  <Modal open={open} title="Chọn loại dịch vụ" onClose={onClose} size="lg">
    <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((cat) => (
        <button
          key={cat._id}
          type="button"
          onClick={() => onSelect(cat._id)}
          className={`group flex min-h-[112px] flex-col items-center justify-center rounded-xl border-2 bg-surface-container-lowest px-3 py-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-md ${categoryId === cat._id ? 'border-primary bg-surface-container-low shadow-primary/10' : 'border-outline-variant/30'
            }`}
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
            <CategoryIcon
              icon={cat.icon}
              name={cat.name}
              className="h-6 w-6 text-primary"
              imageClassName="h-7 w-7 object-contain"
            />
          </div>
          <span className="line-clamp-2 text-label-md font-bold leading-snug text-on-surface">{cat.name}</span>
        </button>
      ))}
    </div>
  </Modal>
);
