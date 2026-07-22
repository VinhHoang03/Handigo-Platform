import { CategoryIcon } from '@/components/common/CategoryIcon';
import type { DataTableColumn } from '@/components/common/dashboard/DataTable';
import type { Category } from '../../types/categoryService.types';
import { formatCategoryDate } from './category.helpers';

interface CategoryTableContext {
  serviceCounts: Record<string, number>;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

/** Cột bảng danh mục, gồm cả cột "Thao tác" (sửa/xóa). */
export function buildCategoryTableColumns({ serviceCounts, onEdit, onDelete }: CategoryTableContext): Array<DataTableColumn<Category>> {
  return [
    {
      key: 'category',
      header: 'Danh mục',
      render: (category) => (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed-dim/30 text-primary">
            <CategoryIcon icon={category.icon} name={category.name} className="h-7 w-7" />
          </div>
          <span className="font-bold text-on-surface">{category.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      className: 'max-w-xs truncate text-on-surface-variant',
      render: (category) => category.description || '—',
    },
    {
      key: 'serviceCount',
      header: 'Số dịch vụ',
      render: (category) => (
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-md font-medium text-on-surface-variant">
          {serviceCounts[category._id] || 0} dịch vụ
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (category) =>
        category.isActive ? (
          <div className="flex items-center gap-2 text-label-md font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success" /> Hoạt động
          </div>
        ) : (
          <div className="flex items-center gap-2 text-label-md font-bold text-error">
            <span className="h-2 w-2 rounded-full bg-error" /> Tạm ngưng
          </div>
        ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      className: 'text-on-surface-variant tabular-nums',
      render: (category) => formatCategoryDate(category.createdAt),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (category) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onEdit(category)} className="rounded-lg p-2 transition-colors hover:bg-primary-container/10 hover:text-primary" aria-label="Sửa">
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button type="button" onClick={() => onDelete(category)} className="rounded-lg p-2 transition-colors hover:bg-error-container/20 hover:text-error" aria-label="Xóa">
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      ),
    },
  ];
}
