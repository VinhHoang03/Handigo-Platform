import { ChevronRight } from "lucide-react";
interface AccountActionRowProps {
  icon: string;
  title: string;
  description: string;
  onClick?: () => void;
}

export function AccountActionRow({
  icon,
  title,
  description,
  onClick,
}: AccountActionRowProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-left transition hover:border-primary/40 hover:bg-surface-container"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
        <span className="min-w-0">
          <span className="block font-label-md font-bold text-on-surface">
            {title}
          </span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            {description}
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={24} className="text-outline-variant" />
    </button>
  );
}
