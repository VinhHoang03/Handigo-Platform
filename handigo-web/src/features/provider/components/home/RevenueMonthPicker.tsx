import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

/** Bộ chọn tháng và năm dạng hai cột cuộn, chỉ cho chọn kỳ đã bắt đầu. */
export function RevenueMonthPicker({ value, max, onChange }: {
  value: string;
  max: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const maxYear = Number(max.slice(0, 4));
  const maxMonth = Number(max.slice(5, 7));
  useEffect(() => {
    if (!open) return;
    root.current?.querySelectorAll<HTMLElement>('[data-selected="true"]').forEach(item => {
      const column = item.parentElement;
      if (column) column.scrollTop = item.offsetTop - (column.clientHeight - item.clientHeight) / 2;
    });
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const listClass = 'relative h-36 space-y-0.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]';
  const itemClass = (selected: boolean) => `flex h-8 w-full items-center justify-between gap-1 whitespace-nowrap rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30 ${selected ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`;
  return <div ref={root} className="relative">
    <button type="button" aria-expanded={open} aria-controls={id} aria-label="Chọn tháng và năm doanh thu"
      onClick={() => setOpen(!open)} className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-8 ${open ? 'border-primary/40 bg-primary/5 text-primary' : 'border-outline-variant/40 bg-surface text-on-surface hover:border-outline-variant'}`}>
      <CalendarDays size={14} aria-hidden="true" className="text-on-surface-variant" />
      <span className="whitespace-nowrap tabular-nums">Tháng {String(month).padStart(2, '0')} / {year}</span>
      <ChevronDown size={12} aria-hidden="true" className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id={id} className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-outline-variant/40 bg-surface p-2.5 shadow-[0_4px_6px_-2px_rgb(0_0_0/0.04),0_12px_28px_-6px_rgb(0_0_0/0.12)]">
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] divide-x divide-outline-variant/30">
        <div className="space-y-1.5 pr-2">
          <p className="px-2 text-[11px] font-medium text-on-surface-variant">Tháng</p>
          <div role="group" aria-label="Chọn tháng doanh thu" className={listClass}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map(item =>
              <button key={item} type="button" aria-pressed={item === month} data-selected={item === month}
                disabled={year === maxYear && item > maxMonth} className={itemClass(item === month)}
                onClick={() => onChange(`${year}-${String(item).padStart(2, '0')}`)}>
                <span>Tháng {String(item).padStart(2, '0')}</span>
                <span className="inline-flex w-3 shrink-0">{item === month && <Check size={12} aria-hidden="true" />}</span>
              </button>)}
          </div>
        </div>
        <div className="space-y-1.5 pl-2">
          <p className="px-2 text-[11px] font-medium text-on-surface-variant">Năm</p>
          <div role="group" aria-label="Chọn năm của tháng doanh thu" className={listClass}>
            {Array.from({ length: maxYear - 2024 }, (_, index) => 2025 + index).map(item =>
              <button key={item} type="button" aria-pressed={item === year} data-selected={item === year} className={itemClass(item === year)}
                onClick={() => {
                  const nextMonth = item === maxYear ? Math.min(month, maxMonth) : month;
                  onChange(`${item}-${String(nextMonth).padStart(2, '0')}`);
                }}><span>{item}</span><span className="inline-flex w-3 shrink-0">{item === year && <Check size={12} aria-hidden="true" />}</span></button>)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-outline-variant/30 pt-2">
        <span className="pl-1 text-[11px] tabular-nums text-on-surface-variant">{String(month).padStart(2, '0')} / {year}</span>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">Xong</button>
      </div>
    </div>}
  </div>;
}
