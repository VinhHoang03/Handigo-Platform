interface ToggleSwitchProps {
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange?: (checked: boolean) => void;
}

export const ToggleSwitch = ({
  defaultChecked = false,
  checked,
  disabled,
  ariaLabel,
  onChange,
}: ToggleSwitchProps) => (
  <label className="relative inline-flex cursor-pointer items-center">
    <input
      defaultChecked={checked === undefined ? defaultChecked : undefined}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange?.(event.target.checked)}
      className="peer sr-only"
      type="checkbox"
    />
    <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
  </label>
);
