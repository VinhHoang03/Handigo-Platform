import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const ROW_HEIGHT = 44;

interface BookingTimeWheelProps {
  label: string;
  values: string[];
  value: string;
  height?: number;
  formatValue?: (value: string) => string;
  isUnavailable: (value: string) => boolean;
  onChange: (value: string) => void;
}

/** Bánh xe xoay theo thao tác kéo, vuốt và lăn chuột; hàng giữa là lựa chọn. */
export function BookingTimeWheel({ label, values, value, height = 220, formatValue, isUnavailable, onChange }: BookingTimeWheelProps) {
  const id = useId();
  const wheelRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, values.indexOf(value));
  const centerY = height / 2;
  const rowTop = centerY - ROW_HEIGHT / 2;
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startY: number; index: number; offset: number; moved: boolean } | null>(null);
  const latest = useRef({ values, selectedIndex, isUnavailable, onChange });

  useLayoutEffect(() => {
    latest.current = { values, selectedIndex, isUnavailable, onChange };
  }, [values, selectedIndex, isUnavailable, onChange]);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    let delta = 0;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (dragRef.current) return;
      if (Math.sign(delta) !== Math.sign(event.deltaY)) delta = 0;
      delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 220 : 1);
      if (Math.abs(delta) < 24) return;
      const direction = Math.sign(delta);
      delta = 0;
      const state = latest.current;
      for (let index = state.selectedIndex + direction; index >= 0 && index < state.values.length; index += direction) {
        if (!state.isUnavailable(state.values[index])) {
          state.onChange(state.values[index]);
          break;
        }
      }
    };
    wheel.addEventListener('wheel', handleWheel, { passive: false });
    return () => wheel.removeEventListener('wheel', handleWheel);
  }, []);

  const selectClosest = (index: number) => {
    const next = values.map((item, position) => ({ item, position }))
      .filter(({ item }) => !isUnavailable(item))
      .sort((a, b) => Math.abs(a.position - index) - Math.abs(b.position - index))[0];
    if (next && next.item !== value) onChange(next.item);
  };

  return (
    <div className="min-w-0">
      <p id={id + '-label'} className="mb-2 text-center text-xs font-semibold text-on-surface-variant">{label}</p>
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-[44px] border-y border-primary/25 bg-primary/10" style={{ top: rowTop }} />
        <div ref={wheelRef} role="listbox" tabIndex={0} aria-labelledby={id + '-label'}
          aria-activedescendant={id + '-option-' + selectedIndex}
          className="relative cursor-grab overflow-hidden select-none rounded-xl active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ height, touchAction: 'none', maskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)' }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, startY: event.clientY, index: selectedIndex, offset: 0, moved: false };
            setIsDragging(true);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const delta = event.clientY - drag.startY;
            drag.moved ||= Math.abs(delta) > 5;
            drag.offset = Math.max(-(values.length - 1 - drag.index) * ROW_HEIGHT, Math.min(drag.index * ROW_HEIGHT, delta));
            setDragOffset(drag.offset);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const next = drag.moved
              ? drag.index - Math.round(drag.offset / ROW_HEIGHT)
              : drag.index + Math.round((event.clientY - event.currentTarget.getBoundingClientRect().top - centerY) / ROW_HEIGHT);
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            setIsDragging(false);
            setDragOffset(0);
            selectClosest(next);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setIsDragging(false);
            setDragOffset(0);
          }}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home' || event.key === 'End') {
              selectClosest(event.key === 'Home' ? 0 : values.length - 1);
              return;
            }
            const direction = event.key === 'ArrowUp' ? -1 : 1;
            for (let next = selectedIndex + direction; next >= 0 && next < values.length; next += direction) {
              if (!isUnavailable(values[next])) { onChange(values[next]); break; }
            }
          }}
        >
          {values.map((item, index) => {
            const offset = (index - selectedIndex) * ROW_HEIGHT + dragOffset;
            const distance = Math.abs(offset / ROW_HEIGHT);
            return (
              <div key={item} id={id + '-option-' + index} role="option"
                aria-selected={index === selectedIndex} aria-disabled={isUnavailable(item)}
                className={'absolute inset-x-0 flex h-[44px] items-center justify-center whitespace-nowrap px-1 text-sm font-semibold tabular-nums sm:text-lg ' + (isUnavailable(item) ? 'text-on-surface-variant/30' : distance < 0.5 ? 'text-primary' : 'text-on-surface-variant')}
                style={{
                  top: rowTop,
                  opacity: distance > 2.5 ? 0 : Math.max(0.15, 1 - distance * 0.3),
                  transform: 'translateY(' + offset + 'px) perspective(240px) rotateX(' + -Math.max(-75, Math.min(75, offset / ROW_HEIGHT * 25)) + 'deg) scale(' + Math.max(0.75, 1 - distance * 0.08) + ')',
                  transition: isDragging ? 'none' : 'transform 180ms ease-out, opacity 180ms ease-out',
                  pointerEvents: 'none',
                }}>
                <span className="max-w-full truncate">{formatValue ? formatValue(item) : item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
