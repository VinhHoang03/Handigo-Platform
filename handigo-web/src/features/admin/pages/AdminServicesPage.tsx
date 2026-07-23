import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { NotificationBanner } from '@/features/notification/components/NotificationBanner';
import { OptionFormModal } from '../components/services/OptionFormModal';
import { ServiceDetailPanel } from '../components/services/ServiceDetailPanel';
import { ServiceFilterBar } from '../components/services/ServiceFilterBar';
import { ServiceFormModal } from '../components/services/ServiceFormModal';
import { ServiceListPanel } from '../components/services/ServiceListPanel';
import { useAdminServicesController } from '../components/services/use-admin-services-controller';
import { Plus } from "lucide-react";

export default function AdminServicesPage() {
  const c = useAdminServicesController();
  const blockClose = c.busy || Boolean(c.discardTarget);

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Danh mục vận hành</p>
            <h1 className="text-wrap-balance font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý dịch vụ</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {c.services.length} dịch vụ · {c.activeServiceCount} hoạt động · {c.services.length - c.activeServiceCount} tạm ngưng
            </p>
          </div>
          <button
            type="button"
            onClick={c.openCreateService}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0"
          >
            <Plus aria-hidden="true" size={24} />
            Thêm dịch vụ mới
          </button>
        </header>

        <NotificationBanner error={c.error} notice={c.notice} />

        <ServiceFilterBar
          search={c.search}
          onSearchDraftChange={(value) => c.setSearchDraft({ value, sourceParam: c.searchParam })}
          onSearchCommit={() => c.updateSearchParams({ search: c.search || null, serviceId: null })}
          categories={c.categories}
          categoryFilter={c.categoryFilter}
          onCategoryFilterChange={(value) => c.updateSearchParams({ category: value || null, serviceId: null })}
          statusFilter={c.statusFilter}
          onStatusFilterChange={(value) => c.updateSearchParams({ status: value || null, serviceId: null })}
          hasFilters={c.hasFilters}
          onClearFilters={c.clearFilters}
          onRefresh={() => void c.reload()}
        />

        <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
          <span>
            Hiển thị <strong className="font-semibold text-on-surface">{c.visibleServices.length}</strong>/{c.services.length} dịch vụ
          </span>
          {c.selectedService && (
            <span className="hidden truncate sm:block">
              Đang xem: <strong className="font-semibold text-on-surface">{c.selectedService.name}</strong>
            </span>
          )}
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">
          <ServiceListPanel
            services={c.visibleServices}
            categories={c.categories}
            loading={c.loading}
            selectedServiceId={c.selectedService?._id || ''}
            hasFilters={c.hasFilters}
            onSelect={(serviceId) => c.updateSearchParams({ serviceId })}
            onClearFilters={c.clearFilters}
          />

          <section id="service-detail" aria-labelledby="service-detail-title" className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm scroll-mt-4">
            <ServiceDetailPanel
              service={c.selectedService}
              categoryName={c.selectedCategoryName}
              options={c.options}
              optionsLoading={c.optionsLoading}
              onEditService={() => c.selectedService && c.openEditService(c.selectedService)}
              onDeleteService={() => c.selectedService && c.setDeleteTarget({ kind: 'service', id: c.selectedService._id, name: c.selectedService.name })}
              onCreateOption={c.openCreateOption}
              onEditOption={c.openEditOption}
              onDeleteOption={(option) => c.setDeleteTarget({ kind: 'option', id: option._id, name: option.name })}
            />
          </section>
        </div>
      </div>

      <ServiceFormModal
        open={Boolean(c.serviceModal)}
        mode={c.serviceModal || 'create'}
        categories={c.categories}
        form={c.serviceForm}
        busy={c.busy}
        blockClose={blockClose}
        onChange={c.setServiceForm}
        onClose={c.requestCloseServiceModal}
        onSubmit={c.saveService}
      />

      <OptionFormModal
        open={Boolean(c.optionModal)}
        mode={c.optionModal || 'create'}
        selectedService={c.selectedService}
        form={c.optionForm}
        busy={c.busy}
        blockClose={blockClose}
        formError={c.optionFormError}
        onChange={c.setOptionForm}
        onClearError={() => c.setOptionFormError('')}
        onClose={c.requestCloseOptionModal}
        onSubmit={c.saveOption}
      />

      <ConfirmDialog
        open={Boolean(c.discardTarget)}
        title="Bỏ thay đổi chưa lưu?"
        message="Các nội dung bạn vừa nhập sẽ không được lưu. Bạn có chắc chắn muốn đóng biểu mẫu?"
        variant="danger"
        onCancel={() => c.setDiscardTarget(null)}
        onConfirm={c.confirmDiscard}
      />

      <ConfirmDialog
        open={Boolean(c.deleteTarget)}
        title={`Xóa ${c.deleteTarget?.kind === 'service' ? 'dịch vụ' : 'tùy chọn'}`}
        message={`Bạn chắc chắn muốn xóa "${c.deleteTarget?.name || ''}"?`}
        busy={c.busy}
        variant="danger"
        onCancel={() => c.setDeleteTarget(null)}
        onConfirm={c.confirmDelete}
      />
    </DashboardShell>
  );
}
