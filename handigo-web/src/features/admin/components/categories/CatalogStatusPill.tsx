interface CatalogStatusPillProps {
  name: string;
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
}

export function CatalogStatusPill({ name, active, busy, onToggle }: CatalogStatusPillProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`Trạng thái hoạt động của ${name}`}
      aria-busy={busy}
      disabled={busy}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      className="inline-flex min-h-11 min-w-14 shrink-0 touch-manipulation items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <span aria-hidden="true" className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${active ? 'justify-end bg-success hover:bg-success/90' : 'justify-start bg-outline hover:bg-outline/90'}`}>
        <span className="h-6 w-6 rounded-full bg-white" />
      </span>
    </button>
  );
}
