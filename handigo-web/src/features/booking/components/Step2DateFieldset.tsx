interface UpcomingDate {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

interface Step2DateFieldsetProps {
  stepNumber: number;
  scheduledAt: string;
  todayInputValue: string;
  upcomingDates: UpcomingDate[];
  onSelectDate: (dateValue: string) => void;
}

/** Chọn ngày thực hiện: nhập ngày bất kỳ hoặc chọn nhanh trong 14 ngày tới. */
export const Step2DateFieldset = ({
  stepNumber, scheduledAt, todayInputValue, upcomingDates, onSelectDate,
}: Step2DateFieldsetProps) => (
  <fieldset>
    <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{stepNumber}</span>
      Chọn ngày thực hiện
    </legend>
    <div className="grid gap-md xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start">
      <label className="flex min-w-0 flex-col gap-xs rounded-xl bg-surface-container-low p-sm text-xs font-bold text-on-surface-variant">
        Chọn ngày bất kỳ
        <input
          type="date"
          name="appointmentDate"
          autoComplete="off"
          min={todayInputValue}
          className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-sm text-base text-on-surface outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
          value={scheduledAt ? scheduledAt.split('T')[0] : ''}
          onChange={(event) => onSelectDate(event.target.value)}
        />
        <span className="font-normal leading-5">
          Bạn có thể chọn mọi ngày trong tương lai, không giới hạn trong danh sách gợi ý.
        </span>
      </label>

      <div>
        <p className="mb-xs text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Hoặc chọn nhanh trong 14 ngày tới
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
    </div>
  </fieldset>
);
