import { money } from "./revenue-format";

const toneClasses = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
} as const;

export function MetricCard({
  label,
  value,
  description,
  tone = "primary",
}: {
  label: string;
  value: number;
  description: string;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className={"mb-4 grid h-10 w-10 place-items-center rounded-xl " + toneClasses[tone]}>
        <span className="material-symbols-outlined">payments</span>
      </div>
      <p className="text-sm font-semibold text-on-surface-variant">{label}</p>
      <p className="mt-1 text-headline-md font-bold tabular-nums text-on-surface">{money.format(value)}</p>
      <p className="mt-2 text-xs leading-5 text-on-surface-variant">{description}</p>
    </article>
  );
}
