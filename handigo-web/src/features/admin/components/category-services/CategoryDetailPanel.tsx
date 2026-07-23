import { CategoryIcon } from '@/components/common/CategoryIcon';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable } from '@/components/common/dashboard/DataTable';
import { TableToolbar } from '@/components/common/dashboard/TableToolbar';
import type { CategoryDetail, Service } from '../../types/categoryService.types';
import { buildServiceTableColumns } from './service-table-columns';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="sm:border-l sm:border-outline-variant/10 sm:pl-4 first:border-l-0 first:pl-0">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className="text-headline-md font-bold">{value}</p>
    </div>
  );
}

interface CategoryDetailPanelProps {
  detailLoading: boolean;
  selected: CategoryDetail | null;
  visibleServices: Service[];
  serviceStatus: string;
  onServiceStatusChange: (value: string) => void;
  onEditCategory: (category: CategoryDetail) => void;
  onCreateService: () => void;
  onDeleteCategory: (category: CategoryDetail) => void;
  onEditService: (service: Service) => void;
  onDeleteService: (service: Service) => void;
}

/** Chi tiết danh mục đang chọn: thông tin chung + bảng dịch vụ thuộc danh mục. */
export function CategoryDetailPanel({
  detailLoading,
  selected,
  visibleServices,
  serviceStatus,
  onServiceStatusChange,
  onEditCategory,
  onCreateService,
  onDeleteCategory,
  onEditService,
  onDeleteService,
}: CategoryDetailPanelProps) {
  if (detailLoading) {
    return <div className="rounded-xl bg-surface-container-low p-8 text-center text-on-surface-variant">Đang tải chi tiết...</div>;
  }
  if (!selected) {
    return <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">Chọn một danh mục để quản lý dịch vụ.</div>;
  }

  const columns = buildServiceTableColumns({ onEdit: onEditService, onDelete: onDeleteService });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CategoryIcon icon={selected.icon} name={selected.name} className="h-11 w-11" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-md font-bold">{selected.name}</h2>
              <StatusBadge value={selected.isActive ? 'active' : 'hidden'} />
            </div>
            <p className="mt-2 max-w-2xl text-on-surface-variant">{selected.description || 'Chưa có mô tả cho danh mục này.'}</p>
            <p className="mt-2 text-sm text-on-surface-variant">/{selected.slug}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onEditCategory(selected)} className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[20px]">edit</span>Sửa
          </button>
          <button onClick={onCreateService} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary">
            <span className="material-symbols-outlined text-[20px]">add</span>Thêm dịch vụ
          </button>
          <button onClick={() => onDeleteCategory(selected)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa danh mục">
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 border-y border-outline-variant/10 py-4 sm:grid-cols-3">
        <Stat label="Tổng dịch vụ" value={selected.services.length} />
        <Stat label="Đang hoạt động" value={selected.services.filter((service) => service.isActive).length} />
        <Stat label="Giá cố định" value={selected.services.filter((service) => service.serviceType === 'fixed_price').length} />
      </div>

      <div className="space-y-4">
        <h3 className="text-headline-md font-bold">Dịch vụ thuộc danh mục</h3>
        <TableToolbar
          filters={
            <select value={serviceStatus} onChange={(event) => onServiceStatusChange(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Đang ẩn</option>
            </select>
          }
        />
        <DataTable
          columns={columns}
          rows={visibleServices}
          rowKey={(service) => service._id}
          emptyState={<div className="p-10 text-center text-on-surface-variant">Chưa có dịch vụ phù hợp.</div>}
          minWidthClassName="min-w-[760px]"
        />
      </div>
    </div>
  );
}
