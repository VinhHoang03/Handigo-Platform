import { DashboardShell } from '@/components/common/DashboardShell';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableToolbar } from '@/components/common/dashboard/TableToolbar';
import { NotificationBanner } from '@/features/notification/components/NotificationBanner';
import { CategoryDetailPanel } from '../components/category-services/CategoryDetailPanel';
import { CategoryFormModal } from '../components/category-services/CategoryFormModal';
import { CategoryListPanel } from '../components/category-services/CategoryListPanel';
import { ServiceFormModal } from '../components/category-services/ServiceFormModal';
import { useAdminCategoryServicesController } from '../components/category-services/use-admin-category-services-controller';
import { Plus } from "lucide-react";

export default function AdminCategoryServicesPage() {
  const c = useAdminCategoryServicesController();

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Quản lý danh mục và dịch vụ</h1>
            <p className="text-on-surface-variant">Tạo danh mục, quản lý các dịch vụ thuộc từng danh mục và trạng thái hiển thị.</p>
          </div>
        </div>

        <TableToolbar
          search={{ value: c.search, onChange: c.setSearch, placeholder: 'Tìm danh mục...' }}
          actions={
            <button
              onClick={c.openCreateCategory}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
            >
              <Plus aria-hidden="true" size={20} />
              Thêm danh mục
            </button>
          }
        />

        <NotificationBanner error={c.error} notice={c.notice} />

        <div className="grid min-h-[640px] gap-6 xl:grid-cols-[380px_1fr]">
          <CategoryListPanel
            categories={c.categories}
            serviceCounts={c.serviceCounts}
            loading={c.loading}
            selectedId={c.selectedId}
            onSelect={c.setSelectedId}
            onRefresh={() => void c.reload()}
          />

          <section className="min-w-0 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            <CategoryDetailPanel
              detailLoading={c.detailLoading}
              selected={c.selected}
              visibleServices={c.visibleServices}
              serviceStatus={c.serviceStatus}
              onServiceStatusChange={c.setServiceStatus}
              onEditCategory={c.openEditCategory}
              onCreateService={c.openCreateService}
              onDeleteCategory={(category) => c.setDeleteTarget({ type: 'category', id: category._id, name: category.name })}
              onEditService={c.openEditService}
              onDeleteService={(service) => c.setDeleteTarget({ type: 'service', id: service._id, name: service.name })}
            />
          </section>
        </div>
      </div>

      <CategoryFormModal
        open={Boolean(c.categoryModal)}
        mode={c.categoryModal || 'create'}
        form={c.categoryForm}
        busy={c.busy}
        onChange={c.setCategoryForm}
        onClose={() => c.setCategoryModal(null)}
        onSubmit={c.saveCategory}
      />
      <ServiceFormModal
        open={Boolean(c.serviceModal)}
        mode={c.serviceModal || 'create'}
        form={c.serviceForm}
        busy={c.busy}
        onChange={c.setServiceForm}
        onClose={() => c.setServiceModal(null)}
        onSubmit={c.saveService}
      />
      <ConfirmDialog
        open={Boolean(c.deleteTarget)}
        title={`Xóa ${c.deleteTarget?.type === 'service' ? 'dịch vụ' : 'danh mục'}`}
        message={`Bạn chắc chắn muốn xóa "${c.deleteTarget?.name || ''}"? Danh mục chỉ xóa được khi không còn dịch vụ.`}
        busy={c.busy}
        onCancel={() => c.setDeleteTarget(null)}
        onConfirm={c.confirmDelete}
      />
    </DashboardShell>
  );
}
