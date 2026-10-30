import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketStatus } from "../../types/adminSupport.types";
import { TicketSidebar } from "./TicketSidebar";
import { TicketThread } from "./TicketThread";

interface TicketDetailProps {
  ticket: AdminSupportTicket;
  admins: AdminUser[];
  adminsLoading: boolean;
  adminsError: string;
  onReloadAdmins: () => void;
  busy: boolean;
  actionError: string;
  onAssign: (adminId: string) => Promise<boolean>;
  onStatusChange: (status: SupportTicketStatus, note?: string) => Promise<boolean>;
  onRespond: (message: string) => Promise<boolean>;
  onCreateViolation: () => void;
}

export function TicketDetail({ ticket, admins, adminsLoading, adminsError, onReloadAdmins, busy, actionError, onAssign, onStatusChange, onRespond, onCreateViolation }: TicketDetailProps) {
  return (
    <>
    {actionError && <p role="alert" className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">{actionError}</p>}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <TicketThread ticket={ticket} busy={busy} onRespond={onRespond} />
      <TicketSidebar
        ticket={ticket}
        admins={admins}
        adminsLoading={adminsLoading}
        adminsError={adminsError}
        onReloadAdmins={onReloadAdmins}
        busy={busy}
        actionError={actionError}
        onAssign={onAssign}
        onStatusChange={onStatusChange}
        onCreateViolation={onCreateViolation}
      />
    </div>
    </>
  );
}
