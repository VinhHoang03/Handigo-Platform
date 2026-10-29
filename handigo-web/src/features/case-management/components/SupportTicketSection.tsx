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
    <>
      <section
        id="tao-yeu-cau-ho-tro"
        className="scroll-mt-28 space-y-6 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 sm:p-7"
      >
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-wider text-primary">
              Hỗ trợ của bạn
            </p>
            <h2 className="mt-2 font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface">
              Theo dõi và trao đổi trên cùng một trang
            </h2>
            <p className="mt-2 max-w-3xl text-pretty leading-6 text-on-surface-variant">
              Tạo yêu cầu mới, xem tiến độ xử lý và phản hồi từ bộ phận hỗ trợ mà
              không cần chuyển sang trang khác.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void support.loadTickets()}
              disabled={support.loading}
              className="btn-secondary min-h-11"
            >
              <span
                aria-hidden="true"
                className={support.loading ? "animate-spin" : ""}
              >
                <RefreshCw aria-hidden="true" size={18} />
              </span>
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary"
            >
              <Plus aria-hidden="true" size={18} className="leading-none" />
              Tạo yêu cầu hỗ trợ
            </button>
          </div>
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
    </>
  );
}
