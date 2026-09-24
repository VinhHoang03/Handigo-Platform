import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { ApplicationDetailModal } from "../components/applications/ApplicationDetailModal";
import { ApplicationFilters } from "../components/applications/ApplicationFilters";
import { ApplicationList } from "../components/applications/ApplicationList";
import { useAdminApplicationsController } from "../components/applications/useAdminApplicationsController";

export default function AdminProviderApplicationsPage() {
  const applications = useAdminApplicationsController();

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-headline-lg font-bold text-on-surface">Duyệt hồ sơ thợ</h1>
        </header>

        <section>
          <ApplicationFilters query={applications.query} categories={applications.categories} onChange={applications.setQuery} />
        </section>

        <section>
          <AsyncState
            loading={applications.loading}
            error={applications.error}
            empty={!applications.items.length}
            emptyMessage="Chưa có hồ sơ phù hợp với bộ lọc."
            onRetry={applications.load}
          >
            <ApplicationList items={applications.items} onSelect={applications.handleSelectApplication} />
          </AsyncState>
        </section>

        <div className="flex justify-center">
          <Pagination
            page={applications.query.page || 1}
            totalPages={applications.totalPages}
            onChange={(page) => applications.setQuery({ ...applications.query, page })}
          />
        </div>
      </div>

      <ApplicationDetailModal
        application={applications.selected}
        busy={applications.busy}
        onApprove={applications.onApprove}
        onReject={applications.onReject}
        onClose={applications.closeModal}
      />
    </DashboardShell>
  );
}
