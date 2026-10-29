import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert } from 'lucide-react';

export function CatalogTooltip({ label, content }: { label: string; content: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16 });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    setPosition({
      left: Math.max(16, Math.min(anchor.left, window.innerWidth - bounds.width - 16)),
      top: Math.max(16, Math.min(
        anchor.bottom + 8 + bounds.height <= window.innerHeight - 16 ? anchor.bottom + 8 : anchor.top - bounds.height - 8,
        window.innerHeight - bounds.height - 16,
      )),
    });
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, content]);

  return <>
    <button ref={triggerRef} type="button" aria-label={label} aria-describedby={open ? id : undefined}
      className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={(event) => { event.stopPropagation(); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
      }}>
      <CircleAlert aria-hidden="true" size={16} />
    </button>
    {open && createPortal(<span ref={tooltipRef} id={id} role="tooltip"
      style={{ ...position, width: 'min(20rem, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)' }}
      className="pointer-events-none fixed z-[1000] overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-normal leading-5 text-on-surface shadow-lg">
      {content}
    </span>, document.body)}
  </>;
}
