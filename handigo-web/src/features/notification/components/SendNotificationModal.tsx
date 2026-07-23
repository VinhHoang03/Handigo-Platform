import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type { NotificationTargetRole } from "../types/notification.types";

export type SendFormState = {
  targetRole: NotificationTargetRole;
  title: string;
  content: string;
};

export function SendNotificationModal({
  open,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: SendFormState;
  busy: boolean;
  onChange: (form: SendFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      open={open}
      title="Gửi thông báo hệ thống"
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Người nhận</span>
          <select
            value={form.targetRole}
            onChange={(event) =>
              onChange({
                ...form,
                targetRole: event.target.value as NotificationTargetRole,
              })
            }
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">Tất cả khách hàng và nhà cung cấp</option>
            <option value="CUSTOMER">Khách hàng</option>
            <option value="PROVIDER">Nhà cung cấp</option>
          </select>
        </label>
        <FormInput
          label="Tiêu đề"
          required
          value={form.title}
          onChange={(value) => onChange({ ...form, title: value })}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nội dung</span>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={form.content}
            onChange={(event) =>
              onChange({ ...form, content: event.target.value })
            }
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
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
            {busy ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
