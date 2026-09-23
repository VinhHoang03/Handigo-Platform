import { timeSlots } from './step2Helpers';

interface Step2TimeSlotFieldsetProps {
  stepNumber: number;
  scheduledAt: string;
  currentTimestamp: number;
  error?: string;
  onSelectSlot: (startTime: string) => void;
}

/** Chọn khung giờ trong ngày đã chọn; disable các khung giờ đã qua. */
export const Step2TimeSlotFieldset = ({
  stepNumber, scheduledAt, currentTimestamp, error, onSelectSlot,
}: Step2TimeSlotFieldsetProps) => (
  <fieldset>
    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{stepNumber}</span>
      Chọn khung giờ
    </legend>
    <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
      {timeSlots.map((slot) => {
        const startTime = slot.split(' ')[0];
        const isSelected = scheduledAt?.includes(`T${startTime}`);
        const selectedDate = scheduledAt?.split('T')[0];
        const isPastSlot = selectedDate
          ? new Date(`${selectedDate}T${startTime}:00`).getTime() <= currentTimestamp
          : false;
        return (
          <button
            key={slot}
            type="button"
            disabled={!scheduledAt || isPastSlot}
            aria-pressed={isSelected}
            onClick={() => onSelectSlot(startTime)}
            className={`min-h-12 rounded-xl border px-sm py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 ${isSelected
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:text-primary'
              }`}
          >
            {slot}
            {isPastSlot && (
              <span className="mt-1 block text-[10px] font-medium">Đã qua</span>
            )}
          </button>
        );
      })}
    </div>
    {error && (
      <p role="alert" className="mt-xs text-xs font-medium text-error">{error}</p>
    )}
  </fieldset>
);
