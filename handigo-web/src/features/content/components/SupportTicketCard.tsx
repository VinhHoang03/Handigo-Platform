import { Headphones } from "lucide-react";
import { Skeleton, SkeletonText } from "@/components/common/Skeleton";
import type { SupportTicket } from "@/features/case-management/types/caseManagement.types";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_CLASSES,
  TICKET_PRIORITY_FALLBACK,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  ticketDate,
} from "../data/supportData";

/** Skeleton bám theo đúng hình dạng thẻ yêu cầu hỗ trợ thật. */
export const TicketListSkeleton = () => (
  <div className="grid gap-4">
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 sm:p-6"
      >
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" rounded="rounded-full" />
          <Skeleton className="h-6 w-20" rounded="rounded-full" />
        </div>
        <Skeleton className="mt-3 h-5 w-1/2" />
        <SkeletonText lines={2} className="mt-3" />
      </div>
    ))}
  </div>
);

export function SupportTicketCard({
  ticket,
  onOpenDetail,
}: {
  ticket: SupportTicket;
  onOpenDetail: (ticketId: string) => void;
}) {
  return (
    <article className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 transition-colors hover:border-primary/30 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
              {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-semibold ${
                TICKET_PRIORITY_CLASSES[ticket.priority] ||
                TICKET_PRIORITY_FALLBACK
              }`}
            >
              {TICKET_PRIORITY_LABELS[ticket.priority] || ticket.priority}
            </span>
            <span>
              {TICKET_CATEGORY_LABELS[ticket.category] || ticket.category}
            </span>
            <span className="tabular-nums">
              #{ticket._id.slice(-8).toUpperCase()}
            </span>
            <span className="tabular-nums">
              {ticketDate.format(new Date(ticket.createdAt))}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-on-surface">
            {ticket.subject}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
            {ticket.description}
          </p>

          {ticket.orderId && (
            <p className="mt-3 text-sm text-on-surface-variant">
              Đơn liên quan: <b>{ticket.orderId.orderCode}</b>
            </p>
          )}

          <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
            <Headphones size={14} />
            <span className="tabular-nums">
              {ticket.responses.length} phản hồi
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(ticket._id)}
          className="btn-secondary min-h-11 shrink-0"
        >
          Xem chi tiết
        </button>
      </div>
    </article>
  );
}
