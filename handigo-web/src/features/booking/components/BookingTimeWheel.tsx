import { useId, useLayoutEffect, useRef, useState } from 'react';

const ROW_HEIGHT = 44;

interface BookingTimeWheelProps {
  label: string;
  values: string[];
  value: string;
  isUnavailable: (value: string) => boolean;
  onChange: (value: string) => void;
}

/** Ba lượt giá trị giúp cuộn qua cuối danh sách rồi tiếp tục từ đầu. */
export function BookingTimeWheel({ label, values, value, isUnavailable, onChange }: BookingTimeWheelProps) {
  const id = useId();
  const wheelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(-1);
  const [position, setPosition] = useState(() => values.length + Math.max(0, values.indexOf(value)));
  const repeatedValues = [...values, ...values, ...values];

  useLayoutEffect(() => {
    const index = Math.max(0, values.indexOf(value));
    if (positionRef.current >= 0 && positionRef.current % values.length === index) return;
    const next = values.length + index;
    positionRef.current = next;
    if (wheelRef.current) wheelRef.current.scrollTop = next * ROW_HEIGHT;
  }, [value, values]);

  const selectPosition = (next: number) => {
    const centered = values.length + ((next % values.length + values.length) % values.length);
    positionRef.current = centered;
    setPosition(centered);
    if (wheelRef.current) wheelRef.current.scrollTop = centered * ROW_HEIGHT;
    onChange(repeatedValues[centered]);
  };

  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className="mb-2 text-center text-xs font-semibold text-on-surface-variant">{label}</p>
      <div className="relative rounded-xl bg-surface-container-low">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-[88px] h-11 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20" />
        <div ref={wheelRef} role="listbox" tabIndex={0} aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-option-${position}`}
          onScroll={(event) => {
            const wheel = event.currentTarget;
            let next = Math.max(0, Math.min(repeatedValues.length - 1, Math.round(wheel.scrollTop / ROW_HEIGHT)));
            if (next < values.length || next >= values.length * 2) {
              const centered = values.length + next % values.length;
              wheel.scrollTop += (centered - next) * ROW_HEIGHT;
              next = centered;
            }
            positionRef.current = next;
            setPosition(next);
            onChange(repeatedValues[next]);
          }}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
            const start = event.key === 'Home' ? -1 : event.key === 'End' ? values.length : positionRef.current;
            for (let step = 1; step <= values.length; step++) {
              const next = (start + direction * step + values.length * 3) % values.length;
              if (!isUnavailable(values[next])) { selectPosition(next); break; }
            }
          }}
          className="relative flex h-[220px] snap-y snap-mandatory flex-col overflow-y-auto overscroll-y-contain rounded-xl py-[88px] touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)' }}>
          {repeatedValues.map((item, index) => {
            const distance = Math.min(3, Math.abs(index - position));
            return <div key={index} id={`${id}-option-${index}`} role="option"
              aria-selected={index === position} aria-disabled={isUnavailable(item)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                wheelRef.current?.focus();
                if (!isUnavailable(item)) selectPosition(index);
              }}
              className={`flex h-11 shrink-0 snap-center items-center justify-center text-xl font-semibold tabular-nums ${isUnavailable(item) ? 'cursor-not-allowed text-on-surface-variant/30' : index === position ? 'cursor-pointer text-primary' : 'cursor-pointer text-on-surface-variant'}`}
              style={{ transform: `perspective(180px) rotateX(${Math.max(-55, Math.min(55, (index - position) * 20))}deg) scale(${1 - distance * 0.08})` }}>
              {item}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
