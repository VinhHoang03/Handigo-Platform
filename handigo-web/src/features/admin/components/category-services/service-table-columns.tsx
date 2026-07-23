import { StatusBadge } from '@/components/common/StatusBadge';
import type { DataTableColumn } from '@/components/common/dashboard/DataTable';
import type { Service } from '../../types/categoryService.types';
import { categoryServiceMoney } from './category-service.helpers';

interface ServiceTableContext {
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}

/** Cột bảng dịch vụ thuộc danh mục đang chọn, gồm cột "Thao tác". */
export function buildServiceTableColumns({ onEdit, onDelete }: ServiceTableContext): Array<DataTableColumn<Service>> {
  return [
    {
      key: 'service',
      header: 'Tên dịch vụ',
      render: (service) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-variant">
            {service.image ? (
              <img alt={service.name} src={service.image} className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-on-surface-variant">home_repair_service</span>
            )}
          </div>
          <div>
            <p className="font-semibold text-on-surface">{service.name}</p>
            <p className="text-sm text-on-surface-variant">/{service.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'priceType',
      header: 'Loại giá',
      render: (service) => (service.serviceType === 'fixed_price' ? 'Giá cố định' : 'Giá linh hoạt'),
    },
    {
      key: 'price',
      header: 'Giá',
      className: 'tabular-nums font-medium',
      render: (service) => (service.serviceType === 'fixed_price' ? 'Theo tùy chọn' : 'Giá linh hoạt'),
    },
    {
      key: 'deposit',
      header: 'Đặt cọc',
      className: 'tabular-nums',
      render: (service) => (service.depositAmount == null ? '-' : categoryServiceMoney.format(service.depositAmount)),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (service) => <StatusBadge value={service.isActive ? 'active' : 'hidden'} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (service) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => onEdit(service)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Sửa dịch vụ">
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
          <button type="button" onClick={() => onDelete(service)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa dịch vụ">
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      ),
    },
  ];
}
