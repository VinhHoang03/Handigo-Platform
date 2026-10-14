import { CalendarDays } from 'lucide-react';

type SelectableOrderType = 'normal' | 'scheduled';
type OrderType = SelectableOrderType | 'urgent' | 'recurring';

interface Step2OrderTypeSelectorProps {
  orderType: OrderType;
  scheduledAt: string;
  isDialogOpen: boolean;
  onChange: (type: SelectableOrderType) => void;
}

export const Step2OrderTypeSelector = ({ orderType, scheduledAt, isDialogOpen, onChange }: Step2OrderTypeSelectorProps) => {
  const isScheduled = orderType === 'scheduled' || orderType === 'recurring';
  const selectedDate = new Date(scheduledAt);
  const label = isScheduled && Number.isFinite(selectedDate.getTime())
    ? `${selectedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${selectedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : 'Hẹn giờ';

  return (
    <button
      type="button"
      aria-pressed={isScheduled}
      aria-haspopup="dialog"
      aria-expanded={isDialogOpen}
      aria-controls={isDialogOpen ? 'booking-date-time-picker' : undefined}
      onClick={() => onChange('scheduled')}
      className={`flex min-h-11 w-full items-center justify-center gap-xs rounded-xl border px-sm py-sm text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${isScheduled
        ? 'border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover active:border-primary-pressed active:bg-primary-pressed'
        : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary hover:bg-primary/10 hover:text-primary active:border-primary-pressed active:bg-primary/15'
        }`}
    >
      <CalendarDays size={20} aria-hidden="true" className="shrink-0" />
      {label}
    </button>
  );
};
