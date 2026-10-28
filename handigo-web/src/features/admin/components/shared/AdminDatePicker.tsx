import { useId, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { BookingTimeWheel } from '@/features/booking/components/BookingTimeWheel';
import { clampDateWheel, dateWheelParts, dateWheelUnavailable, dateWheelValue, displayDateWheel, updateDateWheel, type DateWheelPart } from './adminDatePicker.utils';

interface AdminDatePickerProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  includeTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

const numbers = (count: number, start = 1) => Array.from({ length: count }, (_, index) => String(index + start));

export function AdminDatePicker({ id, label, value, onChange, min, max, includeTime = false, required = false, disabled = false, compact = false }: AdminDatePickerProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const showPicker = () => {
    setDraft(clampDateWheel(dateWheelValue(dateWheelParts(value), includeTime), includeTime, min, max));
    setOpen(true);
  };
  const parts = dateWheelParts(draft);
  const firstYear = Math.max(1, parts.year - 100, min ? Number(min.slice(0, 4)) : 1);
  const lastYear = Math.min(9999, parts.year + 100, max ? Number(max.slice(0, 4)) : 9999);
  const wheels: Array<{ part: DateWheelPart; label: string; values: string[] }> = [
    { part: 'day', label: 'Ngày', values: numbers(31).filter(day => {
      const candidate = dateWheelValue({ ...parts, day: Number(day) }, false);
      return Number(candidate.slice(8, 10)) === Number(day);
    }) },
    { part: 'month', label: 'Tháng', values: numbers(12) },
    { part: 'year', label: 'Năm', values: numbers(Math.max(0, lastYear - firstYear + 1), firstYear) },
    ...(includeTime ? [
      { part: 'hour' as const, label: 'Giờ', values: numbers(24, 0) },
      { part: 'minute' as const, label: 'Phút', values: numbers(60, 0) },
    ] : []),
  ];
  const invalidRange = Boolean(min && max && min > max);
  return <div className={`relative min-w-0 ${compact ? '' : 'w-full'}`}>
    <span id={`${fieldId}-label`} className={compact ? 'absolute -top-2 left-2 z-10 bg-background px-1 text-[11px] text-on-surface-variant' : 'mb-1 block text-sm font-semibold'}>{label}</span>
    <button id={fieldId} type="button" disabled={disabled} onClick={showPicker} aria-labelledby={`${fieldId}-label ${fieldId}-value`} aria-haspopup="dialog" aria-expanded={open}
      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface text-left text-sm font-normal text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${compact ? 'px-3 py-2' : 'p-3'}`}>
      <span id={`${fieldId}-value`} className="whitespace-nowrap">{displayDateWheel(value, includeTime)}</span><CalendarDays aria-hidden="true" size={16} className="shrink-0 text-on-surface-variant" />
    </button>
    {required && <input className="sr-only" tabIndex={-1} aria-hidden="true" type="text" value={value} required disabled={disabled}
      onChange={() => {}} onInvalid={(event) => {
        event.preventDefault();
        if (event.currentTarget.form?.querySelector(':invalid') === event.currentTarget) showPicker();
      }} />}
    <Modal open={open} title={`Chọn ${label.toLocaleLowerCase('vi-VN')}`} onClose={() => setOpen(false)} size={includeTime ? 'md' : 'sm'} compact
      footer={<div className="flex flex-wrap justify-end gap-2">
        {!required && <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mr-auto min-h-11 rounded-xl px-4 text-sm text-error">Xóa</button>}
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold">Hủy</button>
        <button type="button" disabled={invalidRange} onClick={() => { onChange(clampDateWheel(draft, includeTime, min, max)); setOpen(false); }} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-40">Áp dụng</button>
      </div>}>
      <p className="mb-4 text-center text-sm font-semibold">{displayDateWheel(draft, includeTime)}</p>
      <div className={`grid gap-2 ${includeTime ? 'grid-cols-5' : 'grid-cols-3'}`}>
        {wheels.map(wheel => <BookingTimeWheel key={wheel.part} label={wheel.label} values={wheel.values} value={String(parts[wheel.part])} height={176}
          formatValue={item => wheel.part === 'year' ? item : item.padStart(2, '0')}
          isUnavailable={item => invalidRange || dateWheelUnavailable(draft, wheel.part, Number(item), includeTime, min, max)}
          onChange={item => setDraft(current => updateDateWheel(current, wheel.part, Number(item), includeTime, min, max))} />)}
      </div>
      {invalidRange && <p role="alert" className="mt-3 text-sm text-error">Khoảng thời gian không hợp lệ.</p>}
    </Modal>
  </div>;
}
