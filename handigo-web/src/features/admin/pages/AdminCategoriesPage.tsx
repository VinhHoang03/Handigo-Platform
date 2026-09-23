import { useMemo } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Pagination } from '@/components/common/Pagination';
import { DataTable } from '@/components/common/dashboard/DataTable';
import { TableSkeleton } from '@/components/common/dashboard/TableSkeleton';
import { NotificationBanner } from '@/features/notification/components/NotificationBanner';
import { CategoryFilterBar } from '../components/categories/CategoryFilterBar';
import { CategoryFormModal } from '../components/categories/CategoryFormModal';
import { CategoryStatsRow } from '../components/categories/CategoryStatsRow';
import { buildCategoryTableColumns } from '../components/categories/category-table-columns';
import { countActiveCategories } from '../components/categories/category.helpers';
import { useAdminCategoriesController } from '../components/categories/use-admin-categories-controller';
import { Plus } from "lucide-react";

export default function AdminCategoriesPage() {
  const c = useAdminCategoriesController();
  const activeCount = countActiveCategories(c.categories);
  const totalServices = Object.values(c.serviceCounts).reduce((sum, count) => sum + count, 0);

  const columns = useMemo(
    () => buildCategoryTableColumns({ serviceCounts: c.serviceCounts, onEdit: c.openEdit, onDelete: c.setDeleteTarget }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.serviceCounts],
  );

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý danh mục dịch vụ</h1>
            <p className="mt-1 text-on-surface-variant">Quản lý các danh mục dịch vụ trên nền tảng Handigo.</p>
          </div>
          <button
            type="button"
            onClick={c.openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container shadow-md transition-all hover:opacity-90 active:scale-95"
          >
            <Plus aria-hidden="true" size={24} />
            Thêm danh mục
          </button>
        </header>

        <NotificationBanner error={c.error} notice={c.notice} />

        <CategoryStatsRow totalServices={totalServices} activeCount={activeCount} total={c.total} />

        <CategoryFilterBar
          search={c.search}
          onSearchChange={c.setSearch}
          statusFilter={c.statusFilter}
          onStatusFilterChange={c.setStatusFilter}
          onRefresh={() => void c.reload()}
        />

        <AsyncState loading={c.loading} skeleton={<TableSkeleton columns={columns.length} rowCount={c.LIMIT} />}>
          <DataTable
            columns={columns}
            rows={c.categories}
            rowKey={(category) => category._id}
            emptyState={<div className="p-10 text-center text-on-surface-variant">Chưa có danh mục phù hợp.</div>}
            minWidthClassName="min-w-[900px]"
          />
        </AsyncState>

        <div className="flex items-center justify-between text-label-md text-on-surface-variant">
          <span>Hiển thị {c.categories.length} / {c.total} danh mục</span>
        </div>
        <Pagination page={c.page} totalPages={c.totalPages} onChange={c.changePage} />
      </div>

      <CategoryFormModal
        open={Boolean(c.modal)}
        mode={c.modal || 'create'}
        form={c.form}
        busy={c.busy}
        onChange={c.setForm}
        onClose={() => c.setModal(null)}
        onSubmit={c.save}
      />

      <ConfirmDialog
        open={Boolean(c.deleteTarget)}
        title="Xóa danh mục"
        message={`Bạn chắc chắn muốn xóa danh mục "${c.deleteTarget?.name}"? Hành động này không thể khôi phục.`}
        busy={c.busy}
        onCancel={() => c.setDeleteTarget(null)}
        onConfirm={c.confirmDelete}
      />
    </DashboardShell>
  );
}
