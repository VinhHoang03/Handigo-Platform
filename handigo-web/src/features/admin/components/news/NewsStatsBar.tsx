import type { LucideIcon } from "lucide-react";
import { FileEdit, FileText, Globe } from "lucide-react";
interface NewsStatsBarProps {
  total: number;
  published: number;
  drafts: number;
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon aria-hidden="true" size={24} className="block leading-none" />
      </span>
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-headline-md font-bold tabular-nums text-on-surface">{value}</p>
      </div>
    </div>
  );
}

export function NewsStatsBar({ total, published, drafts }: NewsStatsBarProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon={FileText} label="Tổng bài quản trị" value={total} />
      <Stat icon={Globe} label="Đã xuất bản" value={published} />
      <Stat icon={FileEdit} label="Bản nháp" value={drafts} />
    </div>
  );
}
