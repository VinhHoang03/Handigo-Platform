import { CalendarDays, Repeat } from "lucide-react";
import { useState } from 'react';
type SelectableOrderType = 'scheduled' | 'recurring';
type OrderType = SelectableOrderType | 'normal' | 'urgent';

interface Step2OrderTypeSelectorProps {
  orderType: OrderType;
  onChange: (type: SelectableOrderType) => void;
}

export const Step2OrderTypeSelector = ({ orderType, onChange }: Step2OrderTypeSelectorProps) => {
  const [hasSelectedSchedule, setHasSelectedSchedule] = useState(false);
  const isSelected = (type: SelectableOrderType) =>
    orderType === type && (type === 'recurring' || hasSelectedSchedule);

  return (
    <div className="grid grid-cols-2 gap-sm">
      {([
        { type: 'scheduled', label: 'Đặt lịch hẹn', Icon: CalendarDays },
        { type: 'recurring', label: 'Đặt định kỳ', Icon: Repeat },
      ] as const).map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          aria-pressed={isSelected(type)}
          onClick={() => {
            setHasSelectedSchedule(type === 'scheduled');
            onChange(type);
          }}
          className={`flex min-h-11 items-center justify-center gap-xs rounded-xl border px-sm py-sm text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${isSelected(type)
            ? 'border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover active:border-primary-pressed active:bg-primary-pressed'
            : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary hover:bg-primary/10 hover:text-primary active:border-primary-pressed active:bg-primary/15'
            }`}
        >
          <Icon size={20} aria-hidden="true" className="shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
};
