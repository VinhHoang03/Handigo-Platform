import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AdminSupportTicket } from "../../types/adminSupport.types";
import { SupportAttachments } from "./SupportAttachments";
import { SupportPriorityBadge, SupportStatusBadge } from "./SupportBadges";
import { dateTime, ticketAge } from "./support.constants";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { PAYMENT_STATUS_LABELS } from "../payments/payment-constants";

interface TicketThreadProps {
  ticket: AdminSupportTicket;
  busy: boolean;
  onRespond: (message: string) => Promise<boolean>;
}

export function TicketThread({ ticket, busy, onRespond }: TicketThreadProps) {
  const [reply, setReply] = useState("");
  const canRespond = !["resolved", "closed", "cancelled"].includes(
    ticket.status,
  );

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    const message = reply.trim();
    if (!message || !canRespond || busy) return;
    const succeeded = await onRespond(message);
    if (succeeded) setReply("");
  };

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 space-y-5 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          <SupportPriorityBadge priority={ticket.priority} />
          <span className="text-xs text-on-surface-variant">
            #{ticket._id.slice(-8).toUpperCase()}
          </span>
        </div>
        <dl className="space-y-3 text-sm [&>div]:grid [&>div]:gap-1 sm:[&>div]:grid-cols-[160px_minmax(0,1fr)] [&_dt]:text-on-surface-variant [&_dd]:min-w-0">
          <div>
            <dt>Tiêu đề</dt>
            <dd className="font-bold">{ticket.subject}</dd>
          </div>
          <div>
            <dt>Người gửi</dt>
            <dd>
              {ticket.requesterId?.fullName || "Người dùng không còn khả dụng"}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{ticket.requesterId?.email || "Không có thông tin"}</dd>
          </div>
          <div>
            <dt>Thời gian tạo</dt>
            <dd>{dateTime.format(new Date(ticket.createdAt))}</dd>
          </div>
          <div>
            <dt>Đã chờ</dt>
            <dd>{ticketAge(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt>Đơn liên quan</dt>
            <dd className="font-semibold">
              {ticket.orderId?.orderCode || "Không có"}
            </dd>
          </div>
          <div>
            <dt>Trạng thái đơn</dt>
            <dd>
              {ticket.orderId
                ? getOrderStatusMeta(ticket.orderId.status).label
                : "Không áp dụng"}
            </dd>
          </div>
          {ticket.orderId && (
            <div>
              <dt>Thanh toán</dt>
              <dd>
                {ticket.orderId.paymentStatus === "unpaid"
                  ? "Chưa thanh toán"
                  : ticket.orderId.paymentStatus === "partially_paid"
                    ? "Đã thanh toán một phần"
                    : PAYMENT_STATUS_LABELS[
                        ticket.orderId
                          .paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                      ] || "Chưa xác định"}
              </dd>
            </div>
          )}
        </dl>

        <div className="space-y-4 border-t border-outline-variant/40 pt-5">
          <h3 className="font-bold">Mô tả</h3>
          <article className="mr-8 rounded-2xl rounded-tl-sm border border-outline-variant/40 bg-surface p-4">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {ticket.description}
            </p>
            <SupportAttachments attachments={ticket.attachments} />
            <time dateTime={ticket.createdAt} className="mt-3 block text-right text-xs text-on-surface-variant">
              {dateTime.format(new Date(ticket.createdAt))}
            </time>
          </article>
          {ticket.responses.map((response, index) => {
            const isAdmin = response.responderRole === "ADMIN";
            return (
              <article
                key={response.respondedAt + index}
                className={
                  "rounded-2xl border p-4 " +
                  (isAdmin
                    ? "ml-8 rounded-tr-sm border-primary/20 bg-primary/5"
                    : "mr-8 rounded-tl-sm border-outline-variant/40 bg-surface")
                }
              >
                <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                  <b className={isAdmin ? "text-primary" : "text-on-surface"}>
                    {response.responderId?.fullName ||
                      (isAdmin ? "Quản trị viên" : "Người dùng")}
                  </b>
                  <span>{dateTime.format(new Date(response.respondedAt))}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {response.message}
                </p>
                <SupportAttachments attachments={response.attachments} />
              </article>
            );
          })}
        </div>
      </section>

      {(canRespond || reply.length > 0) && (
        <form
          onSubmit={submitReply}
          className="rounded-2xl border border-outline-variant/40 p-4"
        >
          {!canRespond && (
            <p role="status" className="mb-2 text-sm text-on-surface-variant">
              Yêu cầu đã kết thúc. Bản nháp được giữ để bạn xem lại, không thể
              gửi thêm.
            </p>
          )}
          <label htmlFor="support-reply" className="font-bold">
            Phản hồi người dùng
          </label>
          <textarea
            id="support-reply"
            value={reply}
            disabled={busy || !canRespond}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="Nhập hướng dẫn hoặc thông tin cần bổ sung..."
            className="mt-3 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-on-surface-variant">
              {reply.length}/3000 ký tự
            </span>
            <button
              type="submit"
              disabled={busy || !canRespond || !reply.trim()}
              className="btn-primary"
            >
              <Send size={17} /> {busy ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
