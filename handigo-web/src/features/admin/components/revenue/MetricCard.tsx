import { money } from "./revenue-format";
import { Banknote } from "lucide-react";

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
  previous,
  monthly,
}: {
  label: string;
  value: number;
  description: string;
  tone?: keyof typeof toneClasses;
  previous?: number;
  monthly?: boolean;
}) {
  const delta = previous == null ? null : value - previous;
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className={"mb-4 grid h-10 w-10 place-items-center rounded-xl " + toneClasses[tone]}>
        <Banknote aria-hidden="true" size={24} />
      </div>
      <p className="text-sm font-semibold text-on-surface-variant">{label}</p>
      <p className="mt-1 text-right text-headline-md font-bold tabular-nums text-on-surface">{money.format(value)}</p>
      <p className="mt-2 text-xs leading-5 text-on-surface-variant">{description}</p>
      {previous != null && delta != null && <div className="mt-3 border-t border-outline-variant/30 pt-3 text-xs leading-5">
        <p className="text-on-surface-variant">{monthly ? "Tháng trước" : "Khoảng trước"}: {money.format(previous)}</p>
        <p className={delta > 0 ? "text-success" : delta < 0 ? "text-error" : "text-on-surface-variant"}>
          {delta === 0 ? "Không thay đổi" : `${delta > 0 ? "Tăng" : "Giảm"} ${money.format(Math.abs(delta))}${previous === 0 ? " · Chưa tính được % vì giá trị trước bằng 0" : ` (${(Math.abs(delta) / Math.abs(previous) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%)`}`}
        </p>
      </div>}
    </article>
  );
}
