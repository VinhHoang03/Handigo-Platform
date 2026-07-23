import { AsyncState } from '@/components/common/AsyncState';
import { DataTable } from '@/components/common/dashboard/DataTable';
import { TableSkeleton } from '@/components/common/dashboard/TableSkeleton';
import type { Service, ServiceOption } from '../../types/categoryService.types';
import { buildServiceOptionTableColumns } from './service-option-table-columns';
import { getPriceLabel, isImageUrl, serviceMoney } from './service.helpers';

interface ServiceDetailPanelProps {
  service: Service | null;
  categoryName: string;
  options: ServiceOption[];
  optionsLoading: boolean;
  onEditService: () => void;
  onDeleteService: () => void;
  onCreateOption: () => void;
  onEditOption: (option: ServiceOption) => void;
  onDeleteOption: (option: ServiceOption) => void;
}

/** Chi tiết dịch vụ đang chọn: hero thông tin + bảng tùy chọn. */
export function ServiceDetailPanel({
  service,
  categoryName,
  options,
  optionsLoading,
  onEditService,
  onDeleteService,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: ServiceDetailPanelProps) {
  if (!service) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-outline" aria-hidden="true">inventory_2</span>
        <h2 className="mt-3 text-title-lg font-bold text-on-surface">Chưa có dịch vụ được chọn</h2>
        <p className="mt-1 max-w-sm text-sm text-on-surface-variant">Chọn một dịch vụ trong danh sách hoặc thêm dịch vụ mới để quản lý thông tin và tùy chọn.</p>
      </div>
    );
  }

  const columns = buildServiceOptionTableColumns({ service, onEdit: onEditOption, onDelete: onDeleteOption });

  return (
    <>
      <div className="border-b border-outline-variant/30 p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="relative shrink-0">
            <div className="h-28 w-full overflow-hidden rounded-xl bg-surface-variant sm:w-28">
              {service.image && isImageUrl(service.image) ? (
                <img src={service.image} alt={service.name} width={112} height={112} className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-5xl text-on-surface-variant" aria-hidden="true">home_repair_service</span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-wrap-balance font-headline-md text-headline-md font-bold text-on-surface">{service.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${service.isActive ? 'bg-success/10 text-success' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                    {service.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                  </span>
                </div>
                <p className="mt-1 text-label-md font-medium text-on-surface-variant">{categoryName || 'Chưa phân loại'} · {getPriceLabel(service)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onEditService}
                  className="flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>Sửa dịch vụ
                </button>
                <button
                  type="button"
                  onClick={onDeleteService}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-label-md font-bold text-error transition-colors hover:bg-error-container/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                  aria-label={`Xóa dịch vụ ${service.name}`}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>Xóa
                </button>
              </div>
            </div>
            <p className="mt-4 max-w-3xl break-words leading-relaxed text-on-surface-variant">{service.description || 'Chưa có mô tả.'}</p>
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-outline-variant/20 bg-outline-variant/20 sm:grid-cols-3">
              <div className="bg-surface-container-low px-4 py-3">
                <span className="block text-xs text-on-surface-variant">Tùy chọn</span>
                <strong className="mt-1 block font-semibold text-on-surface tabular-nums">{options.length}</strong>
              </div>
              <div className="bg-surface-container-low px-4 py-3">
                <span className="block text-xs text-on-surface-variant">Loại giá</span>
                <strong className="mt-1 block font-semibold text-on-surface">{service.serviceType === 'fixed_price' ? 'Cố định' : 'Linh hoạt'}</strong>
              </div>
              <div className="bg-surface-container-low px-4 py-3">
                <span className="block text-xs text-on-surface-variant">Tiền đặt cọc</span>
                <strong className="mt-1 block font-semibold text-on-surface tabular-nums">
                  {service.serviceType === 'variable_price' ? serviceMoney.format(service.depositAmount || 0) : 'Không áp dụng'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Tùy chọn dịch vụ</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Thiết lập các gói, đơn vị tính và mức giá khách hàng có thể chọn.</p>
          </div>
          <button
            type="button"
            onClick={onCreateOption}
            className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 py-2 font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
            Thêm tùy chọn
          </button>
        </div>
        <AsyncState loading={optionsLoading} skeleton={<TableSkeleton columns={columns.length} rowCount={4} />}>
          <DataTable
            columns={columns}
            rows={options}
            rowKey={(option) => option._id}
            emptyState={
              <div className="p-10 text-center">
                <span className="material-symbols-outlined text-3xl text-outline" aria-hidden="true">playlist_add</span>
                <p className="mt-2 font-semibold text-on-surface">Chưa có tùy chọn nào</p>
                <p className="mt-1 text-sm text-on-surface-variant">Tạo tùy chọn đầu tiên để cấu hình gói và mức giá cho dịch vụ.</p>
                <button
                  type="button"
                  onClick={onCreateOption}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Thêm tùy chọn đầu tiên
                </button>
              </div>
            }
            minWidthClassName="min-w-[760px]"
          />
        </AsyncState>
      </div>
    </>
  );
}
