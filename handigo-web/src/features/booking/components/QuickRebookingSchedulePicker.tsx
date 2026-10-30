import { getEarliestScheduledAt, getInitialScheduledAt, getTodayInputValue, isWithinScheduledBookingHours, timeSlots } from './step2Helpers';

export function QuickRebookingSchedulePicker({ value, onChange, disabled }: {
  value?: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const now = new Date();
  const [date, time = '08:00'] = (value ?? getInitialScheduledAt(undefined, now)).split('T');
  const hour = time.slice(0, 2);
  const minute = time.slice(3, 5);
  const hours = timeSlots.map(slot => slot.slice(0, 2));
  const minutes = (selectedHour: string) => Array.from({ length: selectedHour === '21' ? 1 : 60 }, (_, index) => String(index).padStart(2, '0'));
  const earliest = getEarliestScheduledAt(now).getTime();
  const unavailable = (selectedHour: string, selectedMinute: string) => {
    const timestamp = new Date(`${date}T${selectedHour}:${selectedMinute}:00`).getTime();
    return !Number.isFinite(timestamp) || timestamp < earliest;
  };
  const change = (next: string) => { if (!disabled) onChange(next); };
  const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm';

  return <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
    <label className="col-span-2 text-sm font-semibold">Ngày hẹn
      <input aria-label="Ngày hẹn" type="date" required min={getTodayInputValue(now)} value={date} className={inputClass}
        onChange={event => change(event.target.value
          ? `${event.target.value}T${isWithinScheduledBookingHours(time.slice(0, 5)) ? time.slice(0, 5) : '08:00'}` : '')} />
    </label>
    <label className="text-sm font-semibold">Giờ
      <select aria-label="Giờ hẹn" required disabled={!date || disabled} value={hours.includes(hour) ? hour : ''} className={inputClass}
        onChange={event => {
          const nextHour = event.target.value;
          const nextMinute = minutes(nextHour).includes(minute) && !unavailable(nextHour, minute)
            ? minute : minutes(nextHour).find(item => !unavailable(nextHour, item));
          if (nextMinute !== undefined) change(`${date}T${nextHour}:${nextMinute}`);
        }}>
        <option value="" disabled>Chọn giờ</option>
        {hours.map(item => <option key={item} value={item} disabled={minutes(item).every(part => unavailable(item, part))}>{item}</option>)}
      </select>
    </label>
    <label className="text-sm font-semibold">Phút
      <select aria-label="Phút hẹn" required disabled={!date || disabled} value={minutes(hour).includes(minute) ? minute : ''} className={inputClass}
        onChange={event => change(`${date}T${hour}:${event.target.value}`)}>
        <option value="" disabled>Chọn phút</option>
        {minutes(hour).map(item => <option key={item} value={item} disabled={unavailable(hour, item)}>{item}</option>)}
      </select>
    </label>
  </fieldset>;
}
