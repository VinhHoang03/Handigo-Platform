import type { Complaint, Report, SupportTicket } from "../types/caseManagement.types";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

const getTitle = (item: Complaint | SupportTicket | Report) =>
  "subject" in item ? item.subject : item.title;

interface CaseListItemProps {
  item: Complaint | SupportTicket | Report;
  statusLabel: string;
  onOpenDetail: (id: string) => void;
}

export function CaseListItem({ item, statusLabel, onOpenDetail }: CaseListItemProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{statusLabel}</span>
            <span>#{item._id.slice(-8).toUpperCase()}</span>
            <span>{dateFormatter.format(new Date(item.createdAt))}</span>
          </div>
          <h2 className="mt-3 truncate text-lg font-bold">{getTitle(item)}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">{item.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenDetail(item._id)}
          className="shrink-0 rounded-xl border border-primary px-4 py-2.5 font-semibold text-primary hover:bg-primary/5"
        >
          Xem chi tiết
        </button>
      </div>
    </article>
  );
}
