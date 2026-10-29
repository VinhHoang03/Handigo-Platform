export function NavPendingBadge({ count, compact = false, stale = false }: { count?: number; compact?: boolean; stale?: boolean }) {
  if (!Number.isFinite(count) || !count || count <= 0) return null;
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-error font-bold tabular-nums text-on-error ${compact ? "absolute -right-3 -top-2 h-[18px] min-w-[18px] px-1 text-[9px] ring-2 ring-surface-container-lowest" : "ml-auto h-5 min-w-5 px-1.5 text-[10px]"} ${stale ? "opacity-60" : ""}`}>
    {count > 99 ? "99+" : count}
  </span>;
}
