import type { SelectHTMLAttributes } from 'react';

type FormSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: string;
  value: string | number;
  onValueChange: (value: string) => void;
};

export function FormSelect({
  id,
  label,
  value,
  onValueChange,
  className = '',
  children,
  ...props
}: FormSelectProps) {
  return (
    <label className={`form-select ${className}`} htmlFor={id}>
      <span className="form-select__label">{label}</span>
      <select
        {...props}
        id={id}
        value={value}
        className="form-select__control"
        onChange={(event) => onValueChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

