import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FieldFrameProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function FieldFrame({ id, label, error, hint, className = '', children }: FieldFrameProps) {
  return (
    <div className={`form-field ${error ? 'form-field--error' : ''} ${className}`}>
      <div className="form-field__control">
        {children}
        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>
      </div>
      {(error || hint) && (
        <p className={`mt-1.5 px-1 text-xs ${error ? 'text-error' : 'text-on-surface-variant'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

type FloatingInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'placeholder'
> & {
  label: string;
  value: string | number;
  error?: string;
  hint?: string;
  containerClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
  onValueChange: (value: string) => void;
};

export function FloatingInput({
  id,
  label,
  type = 'text',
  value,
  error,
  hint,
  containerClassName,
  inputRef,
  onValueChange,
  disabled,
  ...props
}: FloatingInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && passwordVisible ? 'text' : type;

  return (
    <FieldFrame
      id={String(id)}
      label={label}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      <input
        {...props}
        ref={inputRef}
        id={id}
        type={resolvedType}
        value={value}
        disabled={disabled}
        placeholder=" "
        aria-invalid={Boolean(error)}
        className={`form-field__input ${isPassword ? 'pr-12' : ''}`}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {isPassword && (
        <button
          type="button"
          className="form-field__action"
          aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={passwordVisible}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPasswordVisible((visible) => !visible)}
        >
          {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      )}
    </FieldFrame>
  );
}

type FloatingTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'placeholder'
> & {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  onValueChange: (value: string) => void;
};

export function FloatingTextarea({
  id,
  label,
  value,
  error,
  hint,
  containerClassName,
  onValueChange,
  ...props
}: FloatingTextareaProps) {
  return (
    <FieldFrame
      id={String(id)}
      label={label}
      error={error}
      hint={hint}
      className={containerClassName}
    >
      <textarea
        {...props}
        id={id}
        value={value}
        placeholder=" "
        aria-invalid={Boolean(error)}
        className="form-field__input form-field__textarea"
        onChange={(event) => onValueChange(event.target.value)}
      />
    </FieldFrame>
  );
}
