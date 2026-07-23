import type { SupportSummary } from "../../types/adminSupport.types";
import { formatDuration } from "./support.constants";
import { AlertCircle, CircleCheckBig, Clock, Inbox, UserX, type LucideIcon } from "lucide-react";
function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" size={22} className="block leading-none" />
        </span>
        <div>
          <p className="text-sm text-on-surface-variant">{label}</p>
          <p className="mt-1 text-headline-md font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
        </div>
      </div>
    </article>
  );
}

export function SupportSummaryCards({ summary }: { summary: SupportSummary }) {
  const cards = [
    { icon: Inbox, label: "Đang tồn", value: summary.active, description: "Ticket cần tiếp tục xử lý" },
    { icon: AlertCircle, label: "Khẩn cấp", value: summary.urgentActive, description: "Ưu tiên xử lý ngay" },
    { icon: UserX, label: "Chưa phân công", value: summary.unassignedActive, description: "Chưa có người phụ trách" },
    { icon: CircleCheckBig, label: "Hoàn tất hôm nay", value: summary.resolvedToday, description: "Đã xử lý hoặc đóng" },
    { icon: Clock, label: "Thời gian xử lý TB", value: formatDuration(summary.averageResolutionMs), description: "Từ lúc tạo đến khi xử lý" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </section>
  );
}
