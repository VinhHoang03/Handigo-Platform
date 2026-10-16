import { useMemo, useState, type RefObject } from 'react';
import { Zap } from 'lucide-react';
import { BookingPickerPopover } from './BookingPickerPopover';
import { BookingTimeWheel } from './BookingTimeWheel';
import { getEarliestScheduledAt, getInitialScheduledAt, timeSlots } from './step2Helpers';

interface UpcomingDate {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

interface BookingDateTimeDialogProps {
  anchorRef: RefObject<HTMLDivElement | null>;
  scheduledAt: string;
  upcomingDates: UpcomingDate[];
  currentTimestamp: number;
  error?: string;
  onCancel: () => void;
  onImmediate: () => void;
  onConfirm: (dateValue: string, startTime: string) => void;
  zIndex?: number;
  description?: string;
  disabled?: boolean;
}

const hours = timeSlots.map((slot) => slot.slice(0, 2));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

const isTimeUnavailable = (time: string, date: string, earliest: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const timestamp = new Date(`${date}T${time}:00`).getTime();
  return !Number.isFinite(timestamp) || timestamp < earliest || hour > 21 || (hour === 21 && minute > 0);
};

const findFirstAvailableTime = (date: string, earliest: number) => {
  for (const hour of hours) {
    const minute = minutes.find((value) => !isTimeUnavailable(`${hour}:${value}`, date, earliest));
    if (minute !== undefined) return `${hour}:${minute}`;
  }
  return undefined;
};

export const BookingDateTimeDialog = ({
  anchorRef, scheduledAt, upcomingDates, currentTimestamp, error, onCancel, onImmediate, onConfirm, zIndex, description, disabled = false,
}: BookingDateTimeDialogProps) => {
  const initialScheduledAt = getInitialScheduledAt(scheduledAt, new Date(currentTimestamp));
  const suggestedDate = initialScheduledAt.split('T')[0];
  const dateIsAvailable = upcomingDates.some((date) => date.value === suggestedDate);
  const initialDate = dateIsAvailable ? suggestedDate : upcomingDates[0]?.value ?? suggestedDate;
  const initialTime = dateIsAvailable ? initialScheduledAt.split('T')[1]?.slice(0, 5) : '08:00';
  const [dateValue, setDateValue] = useState(initialDate);
  const [hour, setHour] = useState(initialTime?.slice(0, 2) || '08');
  const [minute, setMinute] = useState(initialTime?.slice(3, 5) || '00');
  const earliest = getEarliestScheduledAt(new Date(currentTimestamp)).getTime();
  const dateOptions = useMemo(() => upcomingDates.map((date) => ({
    value: date.value,
    label: `${date.weekday} ${date.value.slice(8, 10)}/${date.value.slice(5, 7)}`,
  })), [upcomingDates]);
  const dateValues = useMemo(() => dateOptions.map((date) => date.value), [dateOptions]);
  const firstAvailableTime = findFirstAvailableTime(dateValue, earliest);
  const isUnavailable = (time: string, date = dateValue) => isTimeUnavailable(time, date, earliest);
  const firstAvailableMinute = (selectedHour: string, date = dateValue) =>
    minutes.find((value) => !isUnavailable(`${selectedHour}:${value}`, date));

  const handleDateChange = (nextDate: string) => {
    setDateValue(nextDate);
    if (isUnavailable(`${hour}:${minute}`, nextDate)) {
      const nextTime = findFirstAvailableTime(nextDate, earliest);
      if (nextTime) {
        setHour(nextTime.slice(0, 2));
        setMinute(nextTime.slice(3, 5));
      }
    }
  };

  const selectedDate = dateOptions.find((date) => date.value === dateValue);
  const selectedTime = `${hour}:${minute}`;

  return (
    <BookingPickerPopover id="booking-date-time-picker" title="Chọn ngày và giờ hẹn" anchorRef={anchorRef} onClose={onCancel} zIndex={zIndex}>
        {description && <p className="mb-3 text-xs leading-5 text-on-surface-variant">{description}</p>}
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-xs rounded-2xl bg-surface-container-low px-sm py-sm">
          <BookingTimeWheel
            height={176}
            label="Ngày"
            values={dateValues}
            value={dateValue}
            formatValue={(value) => dateOptions.find((date) => date.value === value)?.label ?? value}
            isUnavailable={(date) => !findFirstAvailableTime(date, earliest)}
            onChange={handleDateChange}
          />
            <BookingTimeWheel
              height={176}
              label="Giờ"
              values={hours}
              value={hour}
              isUnavailable={(value) => firstAvailableMinute(value) === undefined}
              onChange={(value) => {
                setHour(value);
                if (isUnavailable(`${value}:${minute}`)) setMinute(firstAvailableMinute(value) ?? '00');
              }}
            />
            <BookingTimeWheel
              height={176}
              label="Phút"
              values={minutes}
              value={minute}
              isUnavailable={(value) => isUnavailable(`${hour}:${value}`)}
              onChange={setMinute}
            />
        </div>

        <p className="mt-sm text-center text-sm font-semibold text-on-surface">
          {selectedDate?.label ?? 'Chọn ngày'} · {selectedTime}
        </p>
        {error && <p role="alert" className="mt-sm text-center text-sm font-medium text-error">{error}</p>}

        <div className="sticky bottom-0 mt-sm grid grid-cols-2 gap-xs bg-surface-container-lowest pt-sm">
        <button type="button" onClick={onImmediate} disabled={disabled}
          className="flex min-h-11 items-center justify-center gap-xs rounded-xl border border-primary/30 px-xs text-sm font-bold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
          <Zap aria-hidden="true" size={18} />
          Đặt ngay
        </button>

          <button type="button" disabled={disabled || !selectedDate || !firstAvailableTime || isUnavailable(selectedTime)}
            onClick={() => onConfirm(dateValue, selectedTime)}
            className="min-h-11 rounded-xl bg-primary px-xs text-sm font-bold text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
            Xác nhận
          </button>
        </div>
    </BookingPickerPopover>
  );
};
