type SelectableOrderType = 'normal' | 'scheduled' | 'recurring';
type OrderType = SelectableOrderType | 'urgent';

const orderTypeOptions = [
  { icon: 'bolt', type: 'normal' as const, title: 'Đặt lịch ngay', desc: 'Có mặt sớm nhất' },
  { icon: 'event', type: 'scheduled' as const, title: 'Lên lịch hẹn', desc: 'Chọn giờ cụ thể' },
  { icon: 'update', type: 'recurring' as const, title: 'Đặt định kỳ', desc: 'Theo tuần hoặc tháng' },
];

interface Step2OrderTypeSelectorProps {
  orderType: OrderType;
  onChange: (type: SelectableOrderType) => void;
}

/** 3 lựa chọn kiểu đặt lịch: ngay / hẹn giờ / định kỳ. */
export const Step2OrderTypeSelector = ({ orderType, onChange }: Step2OrderTypeSelectorProps) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
    {orderTypeOptions.map(({ icon, type, title, desc }) => (
      <label key={title} className="cursor-pointer">
        <input
          checked={orderType === type}
          onChange={() => onChange(type)}
          className="peer sr-only"
          name="booking_type"
          type="radio"
        />
        <div className="p-sm rounded-2xl border-2 border-outline-variant peer-checked:border-primary peer-checked:bg-primary-container/5 peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15 text-center transition-colors h-full flex flex-col items-center">
          <span className="material-symbols-outlined text-2xl mb-xs">{icon}</span>
          <p className="font-bold text-sm">{title}</p>
          <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
        </div>
      </label>
    ))}
  </div>
);
