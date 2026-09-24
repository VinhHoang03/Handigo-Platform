import type { DataTableColumn } from '@/components/common/dashboard/DataTable';
import type { Service, ServiceOption } from '../../types/categoryService.types';
import { OPTION_TYPE_LABELS, serviceMoney } from './service.helpers';
import { Image, Pencil, Trash2 } from "lucide-react";

interface ServiceOptionTableContext {
  service: Service;
  onEdit: (option: ServiceOption) => void;
  onDelete: (option: ServiceOption) => void;
}

/** Cột bảng tùy chọn của dịch vụ đang chọn, gồm cột "Hành động". */
export function buildServiceOptionTableColumns({ service, onEdit, onDelete }: ServiceOptionTableContext): Array<DataTableColumn<ServiceOption>> {
  return [
    {
      key: 'option',
      header: 'Tên tùy chọn',
      className: 'max-w-72',
      render: (option) => (
        <div className={`flex items-start gap-3 ${!option.isActive ? 'text-on-surface-variant' : ''}`}>
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-low">
            {option.image ? (
              <img src={option.image} alt="" aria-hidden="true" width={48} height={48} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <Image aria-hidden="true" size={24} className="flex h-full w-full items-center justify-center text-on-surface-variant" />
            )}
          </div>
          <div className="min-w-0">
            <p className="break-words font-bold text-on-surface">{option.name}</p>
            {option.description && <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{option.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      className: 'text-on-surface-variant',
      render: (option) => (
        <>
          <p>{OPTION_TYPE_LABELS[option.optionType]}</p>
          {option.selectionGroup && (
            <p className="mt-1 text-xs">
              {option.selectionGroup} · {option.selectionMode === 'single' ? 'chọn một' : 'chọn nhiều'}
            </p>
          )}
          {option.allowsQuantity && <p className="mt-1 text-xs text-primary">Có chọn số lượng</p>}
        </>
      ),
    },
    {
      key: 'price',
      header: 'Giá',
      className: 'text-right font-bold text-primary tabular-nums',
      render: (option) =>
        service.serviceType === 'variable_price' ? <span className="text-on-surface-variant">Không áp dụng</span> : serviceMoney.format(option.price),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (option) =>
        option.isActive ? (
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[12px] font-bold text-success">Hoạt động</span>
        ) : (
          <span className="rounded-full bg-on-surface-variant/10 px-2.5 py-1 text-[12px] font-bold text-on-surface-variant">Tạm ngưng</span>
        ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      className: 'text-right',
      render: (option) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => onEdit(option)} className="grid h-9 w-9 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label={`Sửa tùy chọn ${option.name}`}>
            <Pencil aria-hidden="true" size={16} />
          </button>
          <button type="button" onClick={() => onDelete(option)} className="grid h-9 w-9 place-items-center rounded-lg text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30" aria-label={`Xóa tùy chọn ${option.name}`}>
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ),
    },
  ];
}
