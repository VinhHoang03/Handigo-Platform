import { MessageSquareReply, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketStatus } from "../../types/adminSupport.types";
import { STATUS_LABELS, STATUS_TRANSITIONS } from "./support.constants";

interface TicketSidebarProps {
  ticket: AdminSupportTicket;
  admins: AdminUser[];
  adminsLoading: boolean;
  adminsError: string;
  onReloadAdmins: () => void;
  busy: boolean;
  actionError: string;
  onAssign: (adminId: string) => Promise<boolean>;
  onStatusChange: (status: SupportTicketStatus, note?: string) => Promise<boolean>;
  onCreateViolation: () => void;
}

export function TicketSidebar({ ticket, admins, adminsLoading, adminsError, onReloadAdmins, busy, onAssign, onStatusChange, onCreateViolation }: TicketSidebarProps) {
  const [assignedAdminId, setAssignedAdminId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const isTerminal = ["resolved", "closed", "cancelled"].includes(ticket.status);

  const assignment = assignedAdminId ?? ticket.assignedAdminId?._id ?? "";
  const transitions = ticket.createdViolationId ? [] : STATUS_TRANSITIONS[ticket.status];

  const submitStatus = async () => {
    if (!nextStatus || !transitions.includes(nextStatus)) return;
    const succeeded = await onStatusChange(nextStatus, resolutionNote.trim() || undefined);
    if (succeeded) {
      setNextStatus("");
      setResolutionNote("");
    }
  };

  return (
    <aside className="space-y-5">

      {!ticket.createdViolationId && ticket.status !== "cancelled" && (
        <button type="button" onClick={onCreateViolation} className="w-full rounded-xl bg-error px-4 py-3 font-bold text-on-error">
          Tạo vi phạm và áp dụng hình phạt
        </button>
      )}

      <section className="rounded-2xl border border-outline-variant/40 p-4">
        <div className="flex items-center gap-2">
          <UserRoundCheck size={19} className="text-primary" />
          <h3 className="font-bold">Phân công xử lý</h3>
        </div>
        <select
          value={assignment}
          onChange={(event) => setAssignedAdminId(event.target.value)}
          disabled={isTerminal || busy || adminsLoading || Boolean(adminsError)}
          className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="">Chọn quản trị viên</option>
          {assignment && !admins.some(admin => admin._id === assignment) && <option value={assignment}>{ticket.assignedAdminId?.fullName || "Quản trị viên không còn khả dụng"}</option>}
          {admins.map((admin) => (
            <option key={admin._id} value={admin._id}>{admin.fullName} · {admin.email}</option>
          ))}
        </select>
        {adminsLoading && <p role="status" className="mt-2 text-sm">Đang tải quản trị viên...</p>}
        {adminsError && <p role="alert" className="mt-2 text-sm text-error">{adminsError} <button type="button" onClick={onReloadAdmins} disabled={busy} className="font-semibold underline">Thử lại</button></p>}
        {!adminsLoading && !adminsError && !admins.length && <p className="mt-2 text-sm">Chưa có quản trị viên hoạt động.</p>}
        <button
          type="button"
          onClick={() => assignment && void onAssign(assignment).then(success => { if (success) setAssignedAdminId(null); })}
          disabled={isTerminal || busy || adminsLoading || Boolean(adminsError) || !admins.some(admin => admin._id === assignment) || assignment === ticket.assignedAdminId?._id}
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
          value={nextStatus && transitions.includes(nextStatus) ? nextStatus : ""}
          onChange={(event) => setNextStatus(event.target.value as SupportTicketStatus | "")}
          disabled={busy || !transitions.length}
          className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="">Chọn trạng thái tiếp theo</option>
          {transitions.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
        {nextStatus === "resolved" && (
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="Kết quả xử lý (không bắt buộc)..."
            className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3"
          />
        )}
        <button
          type="button"
          onClick={() => void submitStatus()}
          disabled={busy || !nextStatus || !transitions.includes(nextStatus)}
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
