export function BankAccountStatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <span className="material-symbols-outlined block text-2xl leading-none">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="truncate text-headline-md font-bold text-on-surface">{value}</p>
      </div>
    </div>
  );
}
