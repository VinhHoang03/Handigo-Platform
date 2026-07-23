import type { RecurrenceCount } from './step2Helpers';

type RecurrenceUnit = 'weekly' | 'monthly';

interface Step2RecurrenceFieldsetProps {
  recurrenceUnit: RecurrenceUnit;
  recurrenceCount: RecurrenceCount;
  recurrenceCountOptions: readonly RecurrenceCount[];
  onChangeUnit: (unit: RecurrenceUnit) => void;
  onChangeCount: (count: RecurrenceCount) => void;
}

/** Bước 1 của lịch định kỳ: chọn tần suất (tuần/tháng) và số buổi. */
export const Step2RecurrenceFieldset = ({
  recurrenceUnit, recurrenceCount, recurrenceCountOptions, onChangeUnit, onChangeCount,
}: Step2RecurrenceFieldsetProps) => (
  <fieldset className="rounded-xl border border-outline-variant/40 p-sm">
    <legend className="flex items-center gap-sm px-xs text-sm font-bold text-on-surface">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">1</span>
      Thiết lập chu kỳ
    </legend>
    <div className="mt-sm grid gap-md lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div>
        <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">Lặp lại</p>
        <div className="grid grid-cols-2 gap-xs">
          {(['weekly', 'monthly'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={recurrenceUnit === unit}
              onClick={() => onChangeUnit(unit)}
              className={`min-h-11 rounded-xl border px-sm text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${recurrenceUnit === unit
                ? 'border-primary bg-primary text-on-primary'
                : 'border-outline-variant hover:border-primary hover:text-primary'
                }`}
            >
              {unit === 'weekly' ? 'Hằng tuần' : 'Hằng tháng'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">Số buổi</p>
        <div className={`grid gap-xs ${recurrenceUnit === 'weekly' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {recurrenceCountOptions.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={recurrenceCount === count}
              onClick={() => onChangeCount(count)}
              className={`min-h-11 rounded-xl border px-xs text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${recurrenceCount === count
                ? 'border-primary bg-primary text-on-primary'
                : 'border-outline-variant hover:border-primary hover:text-primary'
                }`}
            >
              {count} buổi
            </button>
          ))}
        </div>
      </div>
    </div>
  </fieldset>
);
