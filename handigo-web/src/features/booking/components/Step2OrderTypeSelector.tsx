import { CalendarDays, Repeat } from "lucide-react";
type SelectableOrderType = 'scheduled' | 'recurring';
type OrderType = SelectableOrderType | 'normal' | 'urgent';

interface Step2OrderTypeSelectorProps {
  orderType: OrderType;
  onChange: (type: SelectableOrderType) => void;
}

export const Step2OrderTypeSelector = ({ orderType, onChange }: Step2OrderTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-sm">
      {([
        { type: 'scheduled', label: 'Đặt lịch hẹn', Icon: CalendarDays },
        { type: 'recurring', label: 'Đặt định kỳ', Icon: Repeat },
      ] as const).map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          aria-pressed={orderType === type}
          onClick={() => onChange(type)}
          className={`flex min-h-11 items-center justify-center gap-xs rounded-xl border px-sm py-sm text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${orderType === type
            ? 'border-primary bg-primary text-on-primary'
            : 'border-outline-variant hover:border-primary hover:text-primary'
            }`}
        >
          <Icon size={20} aria-hidden="true" className="shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
};
