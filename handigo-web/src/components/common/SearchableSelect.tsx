import { useMemo, useRef, useState } from 'react';

export type SearchableSelectOption = {
  value: number;
  label: string;
  searchText?: string;
};

interface SearchableSelectProps {
  id: string;
  label: string;
  value?: number;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  containerClassName?: string;
  onChange: (option: SearchableSelectOption | null) => void;
}

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function SearchableSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Tim kiem...',
  disabled,
  loading,
  error,
  emptyText = 'Khong co du lieu phu hop.',
  containerClassName = '',
  onChange,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return options.slice(0, 80);

    return options
      .filter((option) => {
        const haystack = normalizeSearch(
          `${option.label} ${option.value} ${option.searchText || ''}`,
        );
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 80);
  }, [options, query]);

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option);
    setQuery(option.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className={`relative ${containerClassName}`}>
      <label className="mb-1.5 block text-sm font-medium text-on-surface" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={open ? query : selected?.label || ''}
        disabled={disabled}
        placeholder={loading ? 'Dang tai...' : placeholder}
        className={`min-h-14 w-full rounded-lg border bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? 'border-error' : 'border-outline-variant'
        }`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        autoComplete="off"
        onFocus={() => {
          if (!disabled) {
            setQuery('');
            setOpen(true);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
      />
      {error && <p className="mt-1.5 px-1 text-xs text-error">{error}</p>}

      {open && !disabled && (
        <div
          id={`${id}-options`}
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-outline-variant bg-surface shadow-xl"
          role="listbox"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-on-surface-variant">Dang tai...</div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-surface-container ${
                  option.value === value ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface'
                }`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-on-surface-variant">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}
