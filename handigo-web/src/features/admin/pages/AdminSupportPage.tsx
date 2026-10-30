import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  AdminPageTitle,
  AdminRefreshButton,
} from "@/features/admin/components/shared/AdminPageHeader";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { supportTableColumns } from "../components/support/support-table-columns";
import { SupportFilters } from "../components/support/SupportFilters";
import { SupportSummaryCards } from "../components/support/SupportSummaryCards";
import { TicketDetail } from "../components/support/TicketDetail";
import { useAdminSupportController } from "../components/support/useAdminSupportController";
import { ViolationFormModal } from "../components/cases/ViolationFormModal";
import { getSupportViolationTargets } from "../components/cases/violation-form-options";

export default function AdminSupportPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const revision = useAuthStore((state) => state.sessionRevision);
  return <AdminSupportWorkspace key={revision} embedded={embedded} />;
}

function AdminSupportWorkspace({ embedded }: { embedded: boolean }) {
  const support = useAdminSupportController();

  const content = (
    <>
      <header className="admin-page-header">
        <div>
          <AdminPageTitle title="Yêu cầu hỗ trợ" />
        </div>
        <AdminRefreshButton
          onRefresh={() => void support.load()}
          loading={support.loading}
        />
      </header>

      {(support.refreshError || support.detailError) && (
        <p
          role="status"
          className="rounded-xl bg-warning-container p-3 text-sm text-on-warning-container"
        >
          {support.refreshError || support.detailError} Dữ liệu đang hiển thị có
          thể chưa cập nhật.
        </p>
      )}
      <SupportSummaryCards summary={support.summary} />

      <SupportFilters
        query={support.query}
        searchInput={support.searchInput}
        onSearchInputChange={support.setSearchInput}
        onSubmitSearch={support.submitSearch}
        onFilterChange={support.setFilter}
      />

      <AsyncState
        loading={support.loading}
        error={support.error}
        empty={!support.items.length}
        emptyMessage="Không có yêu cầu hỗ trợ phù hợp."
        onRetry={support.load}
        skeleton={
          <TableSkeleton
            columns={supportTableColumns.length}
            rowCount={support.query.limit || 10}
          />
        }
      >
        <DataTable
          columns={supportTableColumns}
          onRowClick={(ticket) => void support.openTicket(ticket._id)}
          rows={support.items}
          rowKey={(ticket) => ticket._id}
          emptyState={
            <div className="p-10 text-center text-on-surface-variant">
              Không có yêu cầu hỗ trợ phù hợp.
            </div>
          }
          minWidthClassName="min-w-[1170px]"
        />
      </AsyncState>

      <Pagination
        page={support.query.page ?? 1}
        totalPages={support.totalPages}
        onChange={(page) =>
          support.setQuery((current) => ({ ...current, page }))
        }
      />

      <Modal
        open={Boolean(support.selected) || support.detailLoading}
        title="Chi tiết yêu cầu hỗ trợ"
        onClose={support.closeDetail}
        size="xl"
        closeOnOverlayClick={!support.busy}
      >
        {support.detailLoading && !support.selected ? (
          <div className="p-10 text-center text-on-surface-variant">
            Đang tải chi tiết...
          </div>
        ) : support.selected ? (
          <TicketDetail
            key={support.selected._id}
            ticket={support.selected}
            admins={support.admins}
            adminsLoading={support.adminsLoading}
            adminsError={support.adminsError}
            onReloadAdmins={() => void support.loadAdmins()}
            busy={support.busy}
            actionError={support.actionError || support.detailError}
            onAssign={support.onAssign}
            onStatusChange={support.onStatusChange}
            onRespond={support.onRespond}
            onCreateViolation={() =>
              support.setViolationTicket(support.selected)
            }
          />
        ) : null}
      </Modal>

      {support.violationTicket && (
        <ViolationFormModal
          open
          sourceType="SUPPORT_TICKET"
          sourceId={support.violationTicket._id}
          relatedUsers={getSupportViolationTargets(support.violationTicket)}
          orderId={support.violationTicket.orderId?._id}
          onClose={() => support.setViolationTicket(null)}
          onCreated={() => {
            support.setViolationTicket(null);
            support.closeDetail();
            void support.load();
          }}
        />
      )}
    </>
  );
  return embedded ? (
    <section className="space-y-6" aria-label="Quản lý yêu cầu hỗ trợ">
      {content}
    </section>
  ) : (
    <DashboardShell role="ADMIN">{content}</DashboardShell>
  );
}
