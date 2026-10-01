import { CalendarDays, Zap } from "lucide-react";
type SelectableOrderType = 'normal' | 'scheduled' | 'recurring';
type OrderType = SelectableOrderType | 'urgent';

interface Step2OrderTypeSelectorProps {
  orderType: OrderType;
  onChange: (type: SelectableOrderType) => void;
}

export const Step2OrderTypeSelector = ({ orderType, onChange }: Step2OrderTypeSelectorProps) => {
  const hasSchedule = orderType === 'scheduled' || orderType === 'recurring';
  return (
    <div className="space-y-sm">
      <div className="flex items-center gap-sm rounded-xl bg-primary/5 p-sm">
        {hasSchedule ? <CalendarDays size={20} aria-hidden="true" /> : <Zap size={20} aria-hidden="true" />}
        <p className="flex-1 text-sm font-semibold">{hasSchedule ? 'Thực hiện theo lịch hẹn' : 'Sớm nhất có thể'}</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={hasSchedule} onChange={(event) => onChange(event.target.checked ? 'scheduled' : 'normal')} className="size-4 accent-primary" />
        Chọn ngày giờ cụ thể
      </label>
      {hasSchedule && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
          <input type="checkbox" checked={orderType === 'recurring'} onChange={(event) => onChange(event.target.checked ? 'recurring' : 'scheduled')} className="size-4 accent-primary" />
          Lặp lại định kỳ
        </label>
      )}
    </div>
  );
};
