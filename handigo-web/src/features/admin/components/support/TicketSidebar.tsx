import { MessageSquareReply, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketStatus } from "../../types/adminSupport.types";
import { STATUS_LABELS, STATUS_TRANSITIONS } from "./support.constants";

interface TicketSidebarProps {
  ticket: AdminSupportTicket;
  admins: AdminUser[];
  busy: boolean;
  actionError: string;
  onAssign: (adminId: string) => Promise<boolean>;
  onStatusChange: (status: SupportTicketStatus, note?: string) => Promise<boolean>;
  onCreateViolation: () => void;
}

export function TicketSidebar({ ticket, admins, busy, actionError, onAssign, onStatusChange, onCreateViolation }: TicketSidebarProps) {
  const [assignedAdminId, setAssignedAdminId] = useState(ticket.assignedAdminId?._id ?? "");
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const isTerminal = ["closed", "cancelled"].includes(ticket.status);

  const submitStatus = async () => {
    if (!nextStatus) return;
    const succeeded = await onStatusChange(nextStatus, resolutionNote.trim() || undefined);
    if (succeeded) {
      setNextStatus("");
      setResolutionNote("");
    }
  };

  return (
    <aside className="space-y-5">
      {actionError && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{actionError}</p>}

      {!ticket.createdViolationId && ticket.status !== "cancelled" && (
        <button type="button" onClick={onCreateViolation} className="w-full rounded-xl bg-error px-4 py-3 font-bold text-on-error">
          Tạo vi phạm và áp dụng penalty
        </button>
      )}

      <section className="rounded-2xl border border-outline-variant/40 p-4">
        <div className="flex items-center gap-2">
          <UserRoundCheck size={19} className="text-primary" />
          <h3 className="font-bold">Phân công xử lý</h3>
        </div>
        <select
          value={assignedAdminId}
          onChange={(event) => setAssignedAdminId(event.target.value)}
          disabled={isTerminal || busy}
          className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="">Chọn quản trị viên</option>
          {admins.map((admin) => (
            <option key={admin._id} value={admin._id}>{admin.fullName} · {admin.email}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => assignedAdminId && void onAssign(assignedAdminId)}
          disabled={isTerminal || busy || !assignedAdminId || assignedAdminId === ticket.assignedAdminId?._id}
          className="mt-3 w-full rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary disabled:opacity-40"
        >
          Xác nhận phân công
        </button>
      </section>

      <section className="rounded-2xl border border-outline-variant/40 p-4">
        <div className="flex items-center gap-2">
          <MessageSquareReply size={19} className="text-primary" />
          <h3 className="font-bold">Cập nhật trạng thái</h3>
        </div>
        <select
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value as SupportTicketStatus | "")}
          disabled={busy || !STATUS_TRANSITIONS[ticket.status].length}
          className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="">Chọn trạng thái tiếp theo</option>
          {STATUS_TRANSITIONS[ticket.status].map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
        {nextStatus === "resolved" && (
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="Kết quả xử lý (tối thiểu 10 ký tự)..."
            className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3"
          />
        )}
        <button
          type="button"
          onClick={() => void submitStatus()}
          disabled={busy || !nextStatus || (nextStatus === "resolved" && resolutionNote.trim().length < 10)}
          className="mt-3 w-full btn-primary disabled:opacity-40"
        >
          {busy ? "Đang cập nhật..." : "Cập nhật trạng thái"}
        </button>
      </section>

      {ticket.resolutionNote && (
        <section className="rounded-2xl bg-success-container p-4 text-sm text-on-success-container">
          <h3 className="font-bold">Kết quả xử lý</h3>
          <p className="mt-2 whitespace-pre-wrap">{ticket.resolutionNote}</p>
        </section>
      )}
    </aside>
  );
}
