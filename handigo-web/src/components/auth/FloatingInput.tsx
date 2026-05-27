import { MaterialIcon } from '../common/MaterialIcon';

interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  trailingIcon?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const FloatingInput = ({ id, label, type = 'text', trailingIcon, value, onChange }: FloatingInputProps) => (
  <div className="floating-label-group relative">
    <input
      className="peer w-full h-12 px-4 pt-4 bg-surface-container-lowest dark:bg-on-surface-variant/10 border border-outline-variant dark:border-outline/30 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm text-on-surface dark:text-surface-bright"
      id={id}
      placeholder=" "
      required
      type={type}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
    <label
      className="absolute left-4 top-3 text-sm text-on-surface-variant dark:text-outline-variant origin-left transition-all peer-focus:-translate-y-2.5 peer-focus:scale-85 peer-[:not(:placeholder-shown)]:-translate-y-2.5 peer-[:not(:placeholder-shown)]:scale-85"
      htmlFor={id}
    >
      {label}
    </label>
    {trailingIcon && (
      <button className="absolute right-4 top-3 text-on-surface-variant" type="button">
        <MaterialIcon className="text-xl">{trailingIcon}</MaterialIcon>
      </button>
    )}
  </div>
);
