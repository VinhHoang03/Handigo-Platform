import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type { ConfigFormState, ConfigItem } from "./config-definitions";
import { formatValue } from "./system-config-format";

export function ConfigModal({
  item,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  item: ConfigItem | null;
  form: ConfigFormState;
  busy: boolean;
  onChange: (form: ConfigFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (!item) return null;

  return (
    <Modal
      open={Boolean(item)}
      title={`Sửa ${item.label}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
          <p className="text-sm text-on-surface-variant">Key hệ thống</p>
          <p className="mt-1 font-mono font-semibold text-on-surface">
            {item.key}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">{item.effect}</p>
        </div>

        <ValueField item={item} form={form} onChange={onChange} />

        <label className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low p-3">
          <span>
            <span className="block font-semibold">Công khai cho client</span>
            <span className="text-sm text-on-surface-variant">
              Chỉ bật cho dữ liệu hiển thị công khai, không dùng cho cấu hình
              nghiệp vụ nội bộ.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(event) =>
              onChange({ ...form, isPublic: event.target.checked })
            }
            className="h-5 w-5 accent-primary"
          />
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-surface-container-high px-5 py-2.5"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ValueField({
  item,
  form,
  onChange,
}: {
  item: ConfigItem;
  form: ConfigFormState;
  onChange: (form: ConfigFormState) => void;
}) {
  if (item.type === "BOOLEAN") {
    return (
      <div>
        <span className="mb-2 block text-sm font-semibold">Giá trị</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...form,
              value: form.value === "true" ? "false" : "true",
            })
          }
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
            form.value === "true"
              ? "border-primary bg-primary/10 text-primary"
              : "border-outline-variant bg-surface text-on-surface-variant"
          }`}
        >
          <span>
            <span className="block font-semibold">
              {form.value === "true" ? "Đang bật" : "Đang tắt"}
            </span>
            <span className="text-sm">Bấm để chuyển trạng thái bật/tắt.</span>
          </span>
          <span className="material-symbols-outlined text-[28px]">
            {form.value === "true" ? "toggle_on" : "toggle_off"}
          </span>
        </button>
      </div>
    );
  }

  if (item.type === "JSON") {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Giá trị JSON</span>
        <textarea
          required
          rows={8}
          value={form.value}
          onChange={(event) => onChange({ ...form, value: event.target.value })}
          className="w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">
        Giá trị{item.unit ? ` (${item.unit})` : ""}
      </span>
      <input
        type={item.type === "NUMBER" ? "number" : "text"}
        min={item.type === "NUMBER" ? 0 : undefined}
        required
        value={form.value}
        onChange={(event) => onChange({ ...form, value: event.target.value })}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
      />
      {item.type === "NUMBER" && form.value && (
        <p className="mt-1 text-xs tabular-nums text-on-surface-variant">
          Giá trị hiển thị:{" "}
          {formatValue(Number(form.value), item.type, item.unit)}
        </p>
      )}
    </label>
  );
}
