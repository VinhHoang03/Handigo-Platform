import { useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { Pagination } from "@/components/common/Pagination";
import { CreateCaseModal } from "@/features/case-management/components/CreateCaseModal";
import { CaseDetailModal } from "@/features/case-management/components/CaseDetailModal";
import {
  useSupportTickets,
  type SupportRole,
} from "../hooks/useSupportTickets";
import { SupportTicketCard, TicketListSkeleton } from "./SupportTicketCard";
import { SupportTicketFilters } from "./SupportTicketFilters";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Plus, RefreshCw } from "lucide-react";

export type { SupportRole };

interface SupportTicketSectionProps {
  role: SupportRole;
  initialCreate?: boolean;
  initialOrderId?: string;
  onCloseCreate?: () => void;
}

export function SupportTicketSection(props: SupportTicketSectionProps) {
  const revision = useAuthStore(state => state.sessionRevision);
  return <SupportTicketWorkspace key={revision} {...props} />;
}

function SupportTicketWorkspace({ role, initialCreate = false, initialOrderId, onCloseCreate }: SupportTicketSectionProps) {
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreate);
  const support = useSupportTickets();

  return (
    <div className="space-y-8">
      <section
        id="tao-yeu-cau-ho-tro"
        aria-labelledby="tao-ho-tro-heading"
        className="scroll-mt-28 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 sm:p-7"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="tao-ho-tro-heading" className="font-headline-lg text-2xl font-bold tracking-[-0.02em] text-on-surface">
              Tạo yêu cầu
            </h2>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary shrink-0">
            <Plus aria-hidden="true" size={18} />
            Tạo yêu cầu
          </button>
        </div>
      </section>

      <section
        aria-labelledby="danh-sach-ho-tro-heading"
        className="space-y-6 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 sm:p-7"
      >
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="danh-sach-ho-tro-heading" className="font-headline-lg text-2xl font-bold tracking-[-0.02em] text-on-surface">
              Yêu cầu đã gửi
            </h2>
          </div>
          <button type="button" onClick={() => void support.loadTickets()} disabled={support.loading} className="btn-secondary min-h-11 shrink-0">
            <RefreshCw aria-hidden="true" size={18} className={support.loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </header>

        {(support.refreshError || support.detailError) && <p role="status" className="rounded-xl bg-warning-container p-3 text-sm text-on-warning-container">{support.refreshError || support.detailError} Dữ liệu đang hiển thị có thể chưa cập nhật.</p>}
        <SupportTicketFilters
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          ticketQuery={support.ticketQuery}
          onQueryChange={support.setTicketQuery}
        />

        <AsyncState
          loading={support.loading}
          error={support.error}
          empty={!support.tickets.length}
          emptyMessage="Bạn chưa có yêu cầu hỗ trợ nào."
          onRetry={support.loadTickets}
          skeleton={<TicketListSkeleton />}
        >
          <>
            <div className="grid gap-4">
              {support.tickets.map((ticket) => (
                <SupportTicketCard
                  key={ticket._id}
                  ticket={ticket}
                  onOpenDetail={(id) => void support.openTicketDetail(id)}
                />
              ))}
            </div>
            <Pagination
              page={support.ticketQuery.page || 1}
              totalPages={support.totalPages}
              onChange={(page) =>
                support.setTicketQuery((current) => ({ ...current, page }))
              }
            />
          </>
        </AsyncState>
      </section>

      {createOpen && (
        <CreateCaseModal
          open
          kind="ticket"
          role={role}
          initialOrderId={initialOrderId}
          onClose={() => { setCreateOpen(false); onCloseCreate?.(); }}
          onCreated={() => { support.setTicketQuery({ page: 1, limit: 10 }); void support.loadTickets(); }}
        />
      )}
      <CaseDetailModal
        key={support.selected?.item._id || "support-detail"}
        selected={support.selected}
        loading={support.detailLoading}
        busy={support.busy}
        actionError={support.actionError || support.detailError}
        onClose={support.closeDetail}
        onCancel={support.cancelTicket}
        onAddEvidence={async () => false}
        onRespond={support.respondTicket}
      />
    </div>
  );
}
