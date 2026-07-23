import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type { VoucherDiscountType } from "../../types/voucher.types";
import type { VoucherFormState } from "./promotion-format";

export function VoucherModal({
  open,
  mode,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: VoucherFormState;
  busy: boolean;
  onChange: (form: VoucherFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Sửa voucher" : "Tạo voucher"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Mã voucher"
            required
            value={form.code}
            onChange={(value) => onChange({ ...form, code: value.toUpperCase() })}
          />
          <FormInput
            label="Tên hiển thị"
            value={form.name}
            onChange={(value) => onChange({ ...form, name: value })}
          />
        </div>
        <FormTextArea
          label="Mô tả"
          value={form.description}
          onChange={(value) => onChange({ ...form, description: value })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Loại giảm giá</span>
            <select
              value={form.discountType}
              onChange={(event) =>
                onChange({ ...form, discountType: event.target.value as VoucherDiscountType })
              }
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="PERCENT">Phần trăm</option>
              <option value="AMOUNT">Số tiền</option>
            </select>
          </label>
          <FormInput
            label="Giá trị"
            type="number"
            required
            value={form.discountValue}
            onChange={(value) => onChange({ ...form, discountValue: value })}
          />
          <FormInput
            label="Giảm tối đa"
            type="number"
            value={form.maxDiscountAmount}
            onChange={(value) => onChange({ ...form, maxDiscountAmount: value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Đơn tối thiểu"
            type="number"
            value={form.minOrderAmount}
            onChange={(value) => onChange({ ...form, minOrderAmount: value })}
          />
          <FormInput
            label="Giới hạn lượt dùng"
            type="number"
            value={form.usageLimit}
            onChange={(value) => onChange({ ...form, usageLimit: value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput
            label="Bắt đầu"
            type="datetime-local"
            required
            value={form.startAt}
            onChange={(value) => onChange({ ...form, startAt: value })}
          />
          <FormInput
            label="Kết thúc"
            type="datetime-local"
            required
            value={form.endAt}
            onChange={(value) => onChange({ ...form, endAt: value })}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Trạng thái</span>
            <select
              value={form.status}
              onChange={(event) =>
                onChange({ ...form, status: event.target.value as VoucherFormState["status"] })
              }
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm dừng</option>
            </select>
          </label>
        </div>
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

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function FormTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
