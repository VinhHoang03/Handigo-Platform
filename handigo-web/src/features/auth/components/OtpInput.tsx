import { useRef } from "react";

interface OtpInputProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ id, value, onValueChange, disabled = false }: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const focusInput = (index: number) => inputs.current[index]?.focus();
  const updateDigits = (index: number, digits: string) => {
    const slots = Array.from({ length: 6 }, (_, position) => value[position] ?? " ");
    const start = digits.length === 6 ? 0 : index;
    if (!digits) slots[start] = " ";
    else digits.slice(0, 6 - start).split("").forEach((digit, offset) => { slots[start + offset] = digit; });
    onValueChange(slots.join("").trimEnd());
    if (digits) focusInput(Math.min(start + digits.length, 5));
  };

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="text-sm font-medium text-on-surface">Mã OTP</legend>
      <div className="grid grid-cols-6 gap-2 sm:gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(element) => { inputs.current[index] = element; }}
            id={index === 0 ? id : `${id}-${index + 1}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Chữ số thứ ${index + 1} của mã OTP`}
            value={value[index]?.trim() ?? ""}
            maxLength={6}
            pattern="[0-9]"
            required
            className="h-14 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest text-center text-2xl font-semibold text-on-surface caret-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              const digits = raw.replace(/\D/g, "");
              if (!raw || digits) updateDigits(index, digits);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (digits) updateDigits(index, digits);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !value[index]?.trim() && index > 0) {
                event.preventDefault();
                updateDigits(index - 1, "");
                focusInput(index - 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                focusInput(Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1))));
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
