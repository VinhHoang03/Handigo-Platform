interface ProfileTextFieldProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  max?: string;
  required?: boolean;
  highlighted?: boolean;
  error?: string;
  onChange: (value: string) => void;
}

export function ProfileTextField({
  id,
  label,
  value,
  type = "text",
  max,
  required,
  highlighted,
  error,
  onChange,
}: ProfileTextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "min-h-11 w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          error
            ? "border-error focus:border-error focus:ring-error/15"
            : highlighted
              ? "border-primary shadow-[0_0_0_4px_rgba(79,70,229,0.14)]"
              : "border-outline-variant/40",
        ].join(" ")}
      />
      {error && (
        <span className="block text-xs font-medium text-error">{error}</span>
      )}
    </label>
  );
}
