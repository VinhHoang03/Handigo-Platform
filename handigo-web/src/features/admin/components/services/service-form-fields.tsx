/** Các mảnh form dùng chung cho modal dịch vụ và tùy chọn dịch vụ. */

export function FormInput({ label, name, value, onChange, placeholder, type = 'text', required }: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete="off"
        required={required}
        min={type === 'number' ? 0 : undefined}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </label>
  );
}

export function FormTextArea({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea
        name={name}
        autoComplete="off"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </label>
  );
}

export function ToggleRow({ checked, onChange, label, name }: { checked: boolean; onChange: (value: boolean) => void; label: string; name: string }) {
  return (
    <label className="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
      <span className="font-semibold">{label}</span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </label>
  );
}

export function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="min-h-11 rounded-xl bg-surface-container-high px-5 py-2.5 transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {busy ? 'Đang lưu…' : 'Lưu'}
      </button>
    </div>
  );
}
