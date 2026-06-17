import { FloatingInput } from './FloatingField';

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
  <FloatingInput
    id={id}
    label={label}
    type={type}
    value={value}
    disabled={disabled}
    containerClassName={className}
    onValueChange={(nextValue) => onChange?.(nextValue)}
  />
);
