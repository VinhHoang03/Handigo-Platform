export type NotificationStat = {
  icon: string;
  label: string;
  value: number;
};

export function NotificationStatsGrid({
  stats,
}: {
  stats: NotificationStat[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined block text-[24px] leading-none">
              {item.icon}
            </span>
          </span>
          <div>
            <p className="text-sm text-on-surface-variant">{item.label}</p>
            <p className="text-headline-md font-bold text-on-surface">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
