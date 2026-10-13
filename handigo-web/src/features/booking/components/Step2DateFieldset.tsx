import { Step2TimeSlotFieldset } from './Step2TimeSlotFieldset';

interface UpcomingDate {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

interface Step2DateFieldsetProps {
  stepNumber: number;
  scheduledAt: string;
  upcomingDates: UpcomingDate[];
  onSelectDate: (dateValue: string) => void;
  currentTimestamp: number;
  error?: string;
  onSelectSlot: (startTime: string) => void;
}

/** Chọn ngày thực hiện trong 7 ngày tới và khung giờ phù hợp. */
export const Step2DateFieldset = ({
  stepNumber, scheduledAt, upcomingDates, onSelectDate,
  currentTimestamp, error, onSelectSlot,
}: Step2DateFieldsetProps) => (
  <fieldset>
    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{stepNumber}</span>
      Chọn ngày thực hiện
    </legend>
    <div className="grid gap-md">
      <div>
        <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Chọn ngày trong 7 ngày tới
        </p>
        <div className="grid grid-cols-4 gap-xs sm:grid-cols-7">
          {upcomingDates.map((date) => {
            const isSelected = scheduledAt?.split('T')[0] === date.value;
            return (
              <button
                key={date.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectDate(date.value)}
                className={`min-h-20 rounded-xl border px-xs py-sm text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${isSelected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary'
                  }`}
              >
                <span className="block text-[11px] font-medium uppercase">{date.weekday}</span>
                <span className="my-1 block text-xl font-bold leading-none">{date.day}</span>
                <span className="block text-[11px]">{date.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-sm">
        <Step2TimeSlotFieldset
          key={scheduledAt.split('T')[0]}
          scheduledAt={scheduledAt}
          currentTimestamp={currentTimestamp}
          error={error}
          onSelectSlot={onSelectSlot}
        />
      </div>
    </div>
  </fieldset>
);
