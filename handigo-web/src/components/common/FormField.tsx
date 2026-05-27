interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export const FormField = ({ id, label, type = 'text', value = '', className = '', disabled = false, onChange }: FormFieldProps) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-label-sm text-on-surface-variant block ml-1" htmlFor={id}>
      {label}
    </label>
    <input
      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
      disabled={disabled}
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  </div>
);
