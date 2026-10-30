import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, Check, ChevronDown, Wrench } from "lucide-react";
import type { Order } from "@/types/booking";

interface SupportOrderPickerProps {
  orders: Order[];
  value: string;
  disabled: boolean;
  loading: boolean;
  error: string;
  hasMore: boolean;
  onChange: (id: string) => void;
  onLoadMore: () => void;
}

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
});
const supportOrderDate = (order: Order) => {
  const value = order.schedule?.expectedStartAt || order.scheduledAt || order.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có ngày dịch vụ" : dateTime.format(date);
};

export function SupportOrderPicker({ orders, value, disabled, loading, error, hasMore, onChange, onLoadMore }: SupportOrderPickerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = orders.find(order => order._id === value);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    const selectedOption = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (selectedOption ?? list.current?.querySelector<HTMLButtonElement>('[role="option"]'))?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    trigger.current?.focus();
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? Math.min(index + 1, options.length - 1)
      : event.key === "ArrowUp" ? Math.max(index - 1, 0)
        : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (next !== null) { event.preventDefault(); options[next]?.focus(); }
  };

  return <div ref={container} className="relative" onKeyDown={navigate}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className="mb-2 block text-sm font-semibold">Đơn liên quan <span className="font-normal text-on-surface-variant">(không bắt buộc)</span></span>
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open && !disabled}
      aria-controls={`${id}-options`} aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); setOpen(true); } }}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Wrench aria-hidden="true" size={19} /></span>
      <span id={`${id}-value`} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{selected?.serviceId?.name || "Chọn đơn dịch vụ"}</span>
        {selected && <span className="mt-1 block text-xs text-on-surface-variant">{supportOrderDate(selected)}</span>}
      </span>
      <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-on-surface-variant transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </button>
    {open && !disabled && <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_12px_32px_rgba(19,27,46,0.12)]">
      <div ref={list} id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 space-y-1 overflow-y-auto overscroll-contain p-2">
        <button type="button" role="option" tabIndex={-1} aria-selected={!value} onClick={() => choose("")}
          className="w-full rounded-xl px-3 py-3 text-left text-sm text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Không chọn đơn</button>
        {orders.map(order => <button key={order._id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 72px" }} type="button" role="option" tabIndex={-1} aria-selected={value === order._id} onClick={() => choose(order._id)}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${value === order._id ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-surface-container-low"}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-container text-primary"><Wrench aria-hidden="true" size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-on-surface">{order.serviceId?.name || "Dịch vụ"}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant"><CalendarDays aria-hidden="true" size={13} />{supportOrderDate(order)}</span></span>
          {value === order._id && <Check aria-hidden="true" size={18} className="shrink-0 text-primary" />}
        </button>)}
      </div>
      {loading && <p role="status" className="px-4 py-3 text-sm text-on-surface-variant">Đang tải đơn...</p>}
      {error && <p role="alert" className="px-4 py-2 text-sm text-error">{error}</p>}
      {!loading && !error && !orders.length && <p className="px-4 py-3 text-sm text-on-surface-variant">Bạn chưa có đơn dịch vụ.</p>}
      {(hasMore || error) && <button type="button" disabled={loading} onClick={onLoadMore} className="min-h-11 w-full border-t border-outline-variant/30 px-4 py-3 text-sm font-semibold text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{error ? "Thử lại" : "Xem thêm đơn"}</button>}
    </div>}
  </div>;
}
