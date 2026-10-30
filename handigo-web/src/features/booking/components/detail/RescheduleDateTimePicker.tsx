import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookingTimeWheel } from '../BookingTimeWheel';
import { vietnamDateTimeValue, isRescheduleTimeAllowed, firstRescheduleTime } from '../../utils/rescheduleDateTime';

const hours = Array.from({ length: 14 }, (_, index) => String(index + 8).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function RescheduleDateTimePicker({ value, earliest, onChange }: {
  value: string;
  earliest: number;
  onChange: (value: string) => void;
}) {
  const [month, setMonth] = useState(() => value.slice(0, 7));
  const day = value.slice(0, 10);
  const hour = value.slice(11, 13);
  const minute = value.slice(14, 16);
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const moveMonth = (direction: number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + direction);
    setMonth(next.toISOString().slice(0, 7));
  };
  const selectDay = (nextDay: string) => {
    const candidate = `${nextDay}T${hour}:${minute}`;
    const next = isRescheduleTimeAllowed(candidate, earliest) ? candidate : firstRescheduleTime(nextDay, earliest);
    if (next) onChange(next);
  };
  const unavailable = (nextHour: string, nextMinute: string) =>
    !isRescheduleTimeAllowed(`${day}T${nextHour}:${nextMinute}`, earliest);

  return <div className="grid gap-6 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold capitalize">{first.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
        <div className="flex gap-1">
          <button type="button" aria-label="Tháng trước" disabled={month <= vietnamDateTimeValue(earliest).slice(0, 7)} onClick={() => moveMonth(-1)} className="grid size-11 place-items-center rounded-xl hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Tháng sau" onClick={() => moveMonth(1)} className="grid size-11 place-items-center rounded-xl hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map(label => <span key={label} className="py-2 text-xs font-semibold text-on-surface-variant">{label}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, '0')}`;
          return <button key={date} type="button" aria-pressed={date === day}
            aria-label={new Date(`${date}T00:00:00Z`).toLocaleDateString('vi-VN', { dateStyle: 'full', timeZone: 'UTC' })}
            disabled={!firstRescheduleTime(date, earliest)} onClick={() => selectDay(date)}
            className={`min-h-11 rounded-xl text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-25 ${date === day ? 'bg-primary text-on-primary' : 'hover:bg-primary/10'}`}>
            {index + 1}
          </button>;
        })}
      </div>
    </div>
    <div className="min-w-0 border-t border-outline-variant/40 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
      <h3 className="font-semibold">Giờ hẹn mới</h3>
      <p className="mb-3 mt-1 text-xs text-on-surface-variant">Kéo, cuộn hoặc chạm để chọn · Giờ Việt Nam</p>
      <div className="grid grid-cols-2 gap-2">
        <BookingTimeWheel label="Giờ" values={hours} value={hour} height={220}
          isUnavailable={item => minutes.every(m => unavailable(item, m))}
          onChange={item => {
            const nextMinute = unavailable(item, minute) ? minutes.find(m => !unavailable(item, m)) : minute;
            if (nextMinute) onChange(`${day}T${item}:${nextMinute}`);
          }} />
        <BookingTimeWheel label="Phút" values={minutes} value={minute} height={220}
          isUnavailable={item => unavailable(hour, item)} onChange={item => onChange(`${day}T${hour}:${item}`)} />
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-primary">08:00 – 21:00</p>
    </div>
  </div>;
}
