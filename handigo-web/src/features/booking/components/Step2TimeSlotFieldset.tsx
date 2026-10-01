import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { getEarliestScheduledAt, timeSlots } from './step2Helpers';

interface Step2TimeSlotFieldsetProps {
  scheduledAt: string;
  currentTimestamp: number;
  error?: string;
  onSelectSlot: (startTime: string) => void;
}

/** Popup chọn giờ trong ngày, cách thời gian hiện tại ít nhất 2 tiếng. */
export const Step2TimeSlotFieldset = ({
  scheduledAt, currentTimestamp, error, onSelectSlot,
}: Step2TimeSlotFieldsetProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opensUp, setOpensUp] = useState(false);
  const initialIndexRef = useRef(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDate = scheduledAt.split('T')[0];
  const selectedTime = scheduledAt.split('T')[1]?.slice(0, 5);
  const earliest = getEarliestScheduledAt(new Date(currentTimestamp)).getTime();
  const isUnavailable = (slot: string) => new Date(`${selectedDate}T${slot}:00`).getTime() < earliest;

  useLayoutEffect(() => {
    if (!open) return;
    if (wheelRef.current) wheelRef.current.scrollTop = initialIndexRef.current * 36;
    const updateDirection = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const below = top + (viewport?.height ?? window.innerHeight) - trigger.bottom;
      setOpensUp(below < (popupRef.current?.offsetHeight ?? 240) + 16 && trigger.top - top > below);
    };
    updateDirection();
    window.addEventListener('resize', updateDirection);
    window.addEventListener('scroll', updateDirection, true);
    window.visualViewport?.addEventListener('resize', updateDirection);
    return () => {
      window.removeEventListener('resize', updateDirection);
      window.removeEventListener('scroll', updateDirection, true);
      window.visualViewport?.removeEventListener('resize', updateDirection);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative rounded-xl bg-surface-container-low p-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}>
      <label htmlFor={id} className="mb-xs block text-xs font-bold text-on-surface-variant">Chọn khung giờ</label>
      <button ref={triggerRef} id={id} type="button" disabled={!selectedDate}
        aria-expanded={open} aria-controls={`${id}-slots`} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => {
          if (!open) {
            const index = timeSlots.findIndex((slot) => slot === selectedTime && !isUnavailable(slot));
            initialIndexRef.current = index >= 0 ? index : Math.max(0, timeSlots.findIndex((slot) => !isUnavailable(slot)));
            setActiveIndex(initialIndexRef.current);
          }
          setOpen(!open);
        }}
        className="flex min-h-12 w-full items-center gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest px-sm text-sm text-on-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50">
        <Clock size={18} aria-hidden="true" />
        <span className="flex-1 text-left">{selectedTime || (selectedDate ? 'Chọn giờ thực hiện' : 'Vui lòng chọn ngày trước')}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div ref={popupRef} id={`${id}-slots`} role="group" aria-label="Khung giờ thực hiện"
          className={`absolute left-sm z-30 w-40 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl ${opensUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <p className="text-center text-xs text-on-surface-variant">Chọn giờ · 08–21h</p>
          <div className="relative my-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[72px] h-9 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20" />
          <div ref={wheelRef} tabIndex={0} role="listbox" aria-label="Cuộn để chọn giờ"
            aria-activedescendant={`${id}-hour-${activeIndex}`}
            onScroll={(event) => setActiveIndex(Math.max(0, Math.min(timeSlots.length - 1, Math.round(event.currentTarget.scrollTop / 36))))}
            onKeyDown={(event) => {
              if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? timeSlots.length - 1
                : Math.max(0, Math.min(timeSlots.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
              wheelRef.current?.scrollTo({ top: next * 36 });
            }}
            className="relative flex h-[180px] snap-y snap-mandatory flex-col overflow-y-auto overscroll-y-contain touch-pan-y py-[72px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            style={{ maskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)' }}>
            {timeSlots.map((slot, index) => (
              <button key={slot} type="button" disabled={isUnavailable(slot)}
                id={`${id}-hour-${index}`} role="option" tabIndex={-1}
                aria-selected={activeIndex === index}
                title={isUnavailable(slot) ? 'Chưa đủ thời gian đặt trước' : undefined}
                onClick={() => {
                  wheelRef.current?.scrollTo({ top: index * 36 });
                }}
                style={{ transform: `perspective(180px) rotateX(${Math.max(-65, Math.min(65, (index - activeIndex) * 24))}deg) scale(${Math.max(0.75, 1 - Math.abs(index - activeIndex) * 0.1)})` }}
                className={`h-9 shrink-0 snap-center text-center text-base font-bold tabular-nums disabled:cursor-not-allowed disabled:opacity-30 ${activeIndex === index ? 'text-primary' : 'text-on-surface-variant'}`}>
                {slot}
              </button>
            ))}
          </div>
          </div>
          <button type="button" disabled={isUnavailable(timeSlots[activeIndex])}
            onClick={() => {
              onSelectSlot(timeSlots[activeIndex]);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="min-h-9 w-full rounded-lg bg-primary text-xs font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-40">
            Chọn {timeSlots[activeIndex]}
          </button>
          {timeSlots.every(isUnavailable) && <p className="mt-sm text-xs text-on-surface-variant">Ngày này không còn khung giờ đủ thời gian đặt trước. Vui lòng chọn ngày khác.</p>}
        </div>
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-xs text-xs font-medium text-error">{error}</p>}
    </div>
  );
};
