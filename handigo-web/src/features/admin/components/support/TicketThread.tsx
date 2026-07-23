import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AdminSupportTicket } from "../../types/adminSupport.types";
import { SupportAttachments } from "./SupportAttachments";
import { SupportPriorityBadge, SupportStatusBadge } from "./SupportBadges";
import { dateTime, ticketAge } from "./support.constants";

interface TicketThreadProps {
  ticket: AdminSupportTicket;
  busy: boolean;
  onRespond: (message: string) => Promise<boolean>;
}

export function TicketThread({ ticket, busy, onRespond }: TicketThreadProps) {
  const [reply, setReply] = useState("");
  const canRespond = !["resolved", "closed", "cancelled"].includes(ticket.status);

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    const message = reply.trim();
    if (!message) return;
    const succeeded = await onRespond(message);
    if (succeeded) setReply("");
  };

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl bg-surface-container-low p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          <SupportPriorityBadge priority={ticket.priority} />
          <span className="text-xs text-on-surface-variant">#{ticket._id.slice(-8).toUpperCase()}</span>
        </div>
        <h3 className="mt-3 text-headline-sm font-bold">{ticket.subject}</h3>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
          <span>{ticket.requesterId.fullName} · {ticket.requesterId.email}</span>
          <span>Tạo lúc {dateTime.format(new Date(ticket.createdAt))}</span>
          <span>Đã chờ {ticketAge(ticket.createdAt)}</span>
        </div>
        {ticket.orderId && (
          <p className="mt-2 text-sm">
            Đơn liên quan: <b>{ticket.orderId.orderCode}</b> · {ticket.orderId.status} · {ticket.orderId.paymentStatus}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-bold">Trao đổi</h3>
        <article className="mr-8 rounded-2xl rounded-tl-sm border border-outline-variant/40 bg-surface p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
            <b className="text-on-surface">{ticket.requesterId.fullName}</b>
            <span>{dateTime.format(new Date(ticket.createdAt))}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
          <SupportAttachments attachments={ticket.attachments} />
        </article>
        {ticket.responses.map((response, index) => {
          const isAdmin = response.responderRole === "ADMIN";
          return (
            <article
              key={response.respondedAt + index}
              className={"rounded-2xl border p-4 " + (isAdmin ? "ml-8 rounded-tr-sm border-primary/20 bg-primary/5" : "mr-8 rounded-tl-sm border-outline-variant/40 bg-surface")}
            >
              <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                <b className={isAdmin ? "text-primary" : "text-on-surface"}>
                  {response.responderId?.fullName || (isAdmin ? "Quản trị viên" : "Người dùng")}
                </b>
                <span>{dateTime.format(new Date(response.respondedAt))}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{response.message}</p>
              <SupportAttachments attachments={response.attachments} />
            </article>
          );
        })}
      </section>

      {canRespond && (
        <form onSubmit={submitReply} className="rounded-2xl border border-outline-variant/40 p-4">
          <label htmlFor="support-reply" className="font-bold">Phản hồi người dùng</label>
          <textarea
            id="support-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="Nhập hướng dẫn hoặc thông tin cần bổ sung..."
            className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-on-surface-variant">{reply.length}/3000 ký tự</span>
            <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">
              <Send size={17} /> {busy ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
