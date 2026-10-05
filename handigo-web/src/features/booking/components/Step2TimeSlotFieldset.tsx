import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { getEarliestScheduledAt, timeSlots } from './step2Helpers';
import { BookingTimeWheel } from './BookingTimeWheel';

const hours = timeSlots.map((slot) => slot.slice(0, 2));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

interface Step2TimeSlotFieldsetProps {
  scheduledAt: string;
  currentTimestamp: number;
  error?: string;
  onSelectSlot: (startTime: string) => void;
}

/** Chọn giờ từ 08 đến 21 và phút từ 00 đến 59, chặn thời điểm đã qua. */
export const Step2TimeSlotFieldset = ({
  scheduledAt, currentTimestamp, error, onSelectSlot,
}: Step2TimeSlotFieldsetProps) => {
  const [open, setOpen] = useState(false);
  const [pendingHour, setPendingHour] = useState('08');
  const [pendingMinute, setPendingMinute] = useState('00');
  const [opensUp, setOpensUp] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDate = scheduledAt.split('T')[0];
  const selectedTime = scheduledAt.split('T')[1]?.slice(0, 5);
  const earliest = getEarliestScheduledAt(new Date(currentTimestamp)).getTime();
  const isUnavailable = (slot: string) => {
    const timestamp = new Date(`${selectedDate}T${slot}:00`).getTime();
    return !Number.isFinite(timestamp) || timestamp < earliest;
  };

  const firstAvailableMinute = (hour: string) => minutes.find((minute) => !isUnavailable(`${hour}:${minute}`));
  const pendingTime = `${pendingHour}:${pendingMinute}`;

  useLayoutEffect(() => {
    if (!open) return;
    popupRef.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
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
            const validSelection = selectedTime && !isUnavailable(selectedTime);
            const hour = validSelection ? selectedTime.slice(0, 2) : hours.find((value) => firstAvailableMinute(value) !== undefined) ?? hours[0];
            setPendingHour(hour);
            setPendingMinute(validSelection ? selectedTime.slice(3, 5) : firstAvailableMinute(hour) ?? '00');
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
          className={`absolute left-sm z-30 w-64 max-w-[calc(100%_-_16px)] rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xl ${opensUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <p className="text-center text-xs text-on-surface-variant">Giờ 08–21 · Phút 00–59</p>
          <div className="my-3 grid grid-cols-2 gap-3">
            <BookingTimeWheel label="Giờ" values={hours} value={pendingHour}
              isUnavailable={(hour) => firstAvailableMinute(hour) === undefined}
              onChange={(hour) => {
                setPendingHour(hour);
                if (isUnavailable(`${hour}:${pendingMinute}`)) setPendingMinute(firstAvailableMinute(hour) ?? '00');
              }} />
            <BookingTimeWheel label="Phút" values={minutes} value={pendingMinute}
              isUnavailable={(minute) => isUnavailable(`${pendingHour}:${minute}`)} onChange={setPendingMinute} />
          </div>
          <button type="button" disabled={isUnavailable(pendingTime)}
            onClick={() => {
              onSelectSlot(pendingTime);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="min-h-11 w-full rounded-lg bg-primary text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-40">
            Chọn {pendingTime}
          </button>
          {hours.every((hour) => firstAvailableMinute(hour) === undefined) && <p className="mt-sm text-xs text-on-surface-variant">Ngày này không còn khung giờ khả dụng. Vui lòng chọn ngày khác.</p>}
        </div>
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-xs text-xs font-medium text-error">{error}</p>}
    </div>
  );
};
