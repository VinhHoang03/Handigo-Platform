import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, EllipsisVertical } from "lucide-react";

export interface ChartTypeOption {
  value: string;
  label: string;
}

export function ChartTypeMenu({ title, options, value, onChange }: {
  title: string;
  options: ChartTypeOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorTopRef = useRef(0);
  const menuId = useId();

  useLayoutEffect(() => {
    if (position) menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [position]);

  useEffect(() => {
    if (!position) return;
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setPosition(null);
    };
    const closeOnScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node) &&
        Math.abs((triggerRef.current?.getBoundingClientRect().top ?? 0) - anchorTopRef.current) > 1) setPosition(null);
    };
    const close = () => setPosition(null);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [position]);

  const toggle = () => {
    if (position) { setPosition(null); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    anchorTopRef.current = rect.top;
    const menuHeight = Math.min(options.length * 44 + 48, window.innerHeight - 24);
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight
      ? rect.bottom + 8 : Math.max(12, rect.top - menuHeight - 8);
    setPosition({
      top,
      left: Math.max(12, Math.min(rect.right - 224, window.innerWidth - 236)),
      maxHeight: window.innerHeight - top - 12,
    });
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={`Đổi kiểu biểu đồ: ${title}`}
        title="Đổi kiểu biểu đồ" aria-haspopup="menu" aria-expanded={Boolean(position)}
        aria-controls={position ? menuId : undefined} onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!position) toggle(); }
        }}
        className="grid h-11 w-11 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">
        <EllipsisVertical size={20} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div ref={menuRef} id={menuId} role="menu" aria-label={`Kiểu biểu đồ: ${title}`}
          style={position}
          className="fixed z-[100] w-56 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-[0_12px_32px_rgba(19,27,46,0.18)]"
          onKeyDown={(event) => {
            const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "Escape") { event.preventDefault(); setPosition(null); triggerRef.current?.focus(); }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}>
          <p className="px-3 py-2 text-xs font-semibold text-on-surface-variant">Kiểu hiển thị</p>
          {options.map((option) => (
            <button key={option.value} type="button" role="menuitemradio" aria-checked={value === option.value}
              tabIndex={value === option.value ? 0 : -1}
              onClick={() => { onChange(option.value); setPosition(null); triggerRef.current?.focus(); }}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-on-surface hover:bg-surface-container focus-visible:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">
              {option.label}{value === option.value && <Check size={16} aria-hidden="true" className="shrink-0 text-primary" />}
            </button>
          ))}
        </div>, document.body,
      )}
    </>
  );
}
