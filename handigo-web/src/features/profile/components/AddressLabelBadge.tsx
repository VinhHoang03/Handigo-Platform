import { AddressLabelIcon } from "./AddressLabelIcon";

interface AddressLabelBadgeProps {
  label?: string;
  className?: string;
}

export function AddressLabelBadge({ label, className = "" }: AddressLabelBadgeProps) {
  const normalizedLabel = label?.trim();
  if (!normalizedLabel) return null;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold text-secondary ${className}`}
    >
      <AddressLabelIcon
        label={normalizedLabel}
        aria-hidden="true"
        size={13}
        strokeWidth={2.2}
        className="shrink-0"
      />
      <span className="truncate">{normalizedLabel}</span>
    </span>
  );
}
