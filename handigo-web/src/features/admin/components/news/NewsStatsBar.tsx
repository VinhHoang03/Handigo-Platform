interface NewsStatsBarProps {
  total: number;
  published: number;
  drafts: number;
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <span aria-hidden="true" className="material-symbols-outlined block text-[24px] leading-none">
          {icon}
        </span>
      </span>
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-on-surface">{value}</p>
      </div>
    </div>
  );
}

export function NewsStatsBar({ total, published, drafts }: NewsStatsBarProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon="article" label="Tổng bài quản trị" value={total} />
      <Stat icon="public" label="Đã xuất bản" value={published} />
      <Stat icon="draft" label="Bản nháp" value={drafts} />
    </div>
  );
}
