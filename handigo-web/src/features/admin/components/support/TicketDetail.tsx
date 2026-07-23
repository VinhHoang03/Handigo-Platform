import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketStatus } from "../../types/adminSupport.types";
import { TicketSidebar } from "./TicketSidebar";
import { TicketThread } from "./TicketThread";

interface TicketDetailProps {
  ticket: AdminSupportTicket;
  admins: AdminUser[];
  busy: boolean;
  actionError: string;
  onAssign: (adminId: string) => Promise<boolean>;
  onStatusChange: (status: SupportTicketStatus, note?: string) => Promise<boolean>;
  onRespond: (message: string) => Promise<boolean>;
  onCreateViolation: () => void;
}

export function TicketDetail({ ticket, admins, busy, actionError, onAssign, onStatusChange, onRespond, onCreateViolation }: TicketDetailProps) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <TicketThread ticket={ticket} busy={busy} onRespond={onRespond} />
      <TicketSidebar
        ticket={ticket}
        admins={admins}
        busy={busy}
        actionError={actionError}
        onAssign={onAssign}
        onStatusChange={onStatusChange}
        onCreateViolation={onCreateViolation}
      />
    </div>
  );
}
