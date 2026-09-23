import type { ReactNode } from "react";

interface ProfileDisplayFieldProps {
  label: string;
  value: string;
  action?: ReactNode;
  highlighted?: boolean;
}

export function ProfileDisplayField({
  label,
  value,
  action,
  highlighted,
}: ProfileDisplayFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </label>
      <div
        className={[
          "relative flex min-h-11 items-center rounded-lg border bg-surface-container-low px-3 text-sm text-on-surface transition",
          highlighted
            ? "border-primary shadow-[0_0_0_4px_rgba(79,70,229,0.14)]"
            : "border-outline-variant/30",
          action ? "pr-11" : "",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{value || "Chưa cập nhật"}</span>
        {action}
      </div>
    </div>
  );
}
