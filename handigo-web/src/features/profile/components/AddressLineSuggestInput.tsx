import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { bookingApi } from "@/features/booking/api/booking.api";

interface AddressLineSuggestInputProps {
  value: string;
  province?: string;
  ward?: string;
  onChange: (value: string) => void;
}

interface Suggestion {
  label: string;
  addressLine: string;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

/** Ô "Địa chỉ cụ thể" có gợi ý từ backend (LocationIQ); lỗi gợi ý không chặn việc tự nhập. */
export function AddressLineSuggestInput({
  value,
  province,
  ward,
  onChange,
}: AddressLineSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Chỉ gợi ý khi khách đang gõ, không gợi ý lại khi chọn xong hoặc mở form sửa.
  const typingRef = useRef(false);

  useEffect(() => {
    const query = value.trim();
    if (!typingRef.current || query.length < MIN_QUERY_LENGTH) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await bookingApi.suggestAddresses(
          query,
          { province, ward },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSuggestions(result);
        setOpen(result.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, province, ward]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        minLength={2}
        required
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Nhập số nhà, tên đường, tòa nhà..."
        className="form-field__input pb-2 pt-2"
        onChange={(event) => {
          typingRef.current = true;
          onChange(event.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {loading && (
        <span className="absolute right-2 top-2 text-xs text-on-surface-variant">
          Đang tìm...
        </span>
      )}
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-outline-variant/40 bg-surface shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item.label} role="option" aria-selected="false">
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  typingRef.current = false;
                  setOpen(false);
                  setSuggestions([]);
                  onChange(item.addressLine);
                }}
              >
                <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong className="block font-semibold">{item.addressLine}</strong>
                  <small className="text-on-surface-variant">{item.label}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
