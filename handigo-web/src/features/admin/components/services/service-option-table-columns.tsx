import { Pencil, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { DataTableColumn } from '@/components/common/dashboard/DataTable';
import type { Service, ServiceOption } from '../../types/categoryService.types';
import { OPTION_TYPE_LABELS, serviceMoney } from './service.helpers';

interface ServiceOptionTableContext {
  service: Service;
  onEdit: (option: ServiceOption) => void;
  onDelete: (option: ServiceOption) => void;
}

/** Cột thông tin và thao tác của bảng tùy chọn dịch vụ. */
export function buildServiceOptionTableColumns({ service, onEdit, onDelete }: ServiceOptionTableContext): Array<DataTableColumn<ServiceOption>> {
  return [
    {
      key: 'name',
      header: 'Tùy chọn',
      render: (option) => (
        <div className="flex items-center gap-3">
          {option.image && <img src={option.image} alt={option.name} className="h-10 w-10 rounded-lg object-cover" />}
          <div>
            <p className="font-semibold text-on-surface">{option.name}</p>
            {option.description && <p className="text-sm text-on-surface-variant">{option.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại tùy chọn',
      render: (option) => OPTION_TYPE_LABELS[option.optionType],
    },
    {
      key: 'selection',
      header: 'Cách lựa chọn',
      render: (option) => (
        <div>
          <p>{option.selectionGroup || 'Không phân nhóm'}</p>
          <p className="text-sm text-on-surface-variant">
            {option.selectionMode === 'single' ? 'Chỉ chọn một' : 'Được chọn nhiều'}
            {option.allowsQuantity ? ' · Có số lượng' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Giá',
      className: 'tabular-nums',
      render: (option) => service.serviceType === 'variable_price' ? 'Theo báo giá' : serviceMoney.format(option.price),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (option) => <StatusBadge value={option.isActive ? 'active' : 'hidden'} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (option) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => onEdit(option)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Sửa tùy chọn ${option.name}`}>
            <Pencil aria-hidden="true" size={20} />
          </button>
          <button type="button" onClick={() => onDelete(option)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label={`Xóa tùy chọn ${option.name}`}>
            <Trash2 aria-hidden="true" size={20} />
          </button>
        </div>
      ),
    },
  ];
}
