export function ProfileTextInput({
  id,
  label,
  value,
  type = "text",
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

export function ProfileTextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <textarea
        id={id}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

export function ProfileSelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
