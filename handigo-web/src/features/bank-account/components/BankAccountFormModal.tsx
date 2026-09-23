import type { FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import type { BankAccountStatus } from '../types/bankAccount.types';
import { type BankAccountForm, vietnamBanks } from './bankAccountConstants';

function FormInput({
  label,
  value,
  onChange,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        required={required}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export function BankAccountFormModal({
  open,
  mode,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  form: BankAccountForm;
  busy: boolean;
  onChange: (form: BankAccountForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const selectedBank = vietnamBanks.find((bank) => bank.code === form.bankCode);
  const bankSelectValue = form.bankMode === 'custom' ? 'custom' : selectedBank?.code || '';

  const handleBankSelect = (value: string) => {
    if (value === 'custom') {
      onChange({ ...form, bankMode: 'custom', bankName: '', bankCode: '' });
      return;
    }

    const bank = vietnamBanks.find((item) => item.code === value);
    if (bank) {
      onChange({ ...form, bankMode: 'list', bankName: bank.name, bankCode: bank.code });
    }
  };

  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'} onClose={onClose} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Ngân hàng</span>
          <select
            required={!form.bankName || !form.bankCode}
            value={bankSelectValue}
            onChange={(event) => handleBankSelect(event.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Chọn ngân hàng</option>
            {vietnamBanks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.shortName} - {bank.code} - {bank.name}
              </option>
            ))}
            <option value="custom">Khác - nhập thủ công</option>
          </select>
        </label>
        {form.bankMode === 'custom' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Tên ngân hàng" required value={form.bankName} onChange={(value) => onChange({ ...form, bankName: value })} />
            <FormInput label="Mã ngân hàng" required value={form.bankCode} onChange={(value) => onChange({ ...form, bankCode: value.toUpperCase() })} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Số tài khoản" required minLength={4} value={form.accountNumber} onChange={(value) => onChange({ ...form, accountNumber: value })} />
          <FormInput label="Tên chủ tài khoản" required minLength={2} value={form.accountHolderName} onChange={(value) => onChange({ ...form, accountHolderName: value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Trạng thái</span>
            <select
              value={form.status}
              onChange={(event) => onChange({ ...form, status: event.target.value as BankAccountStatus })}
              className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => onChange({ ...form, isDefault: event.target.checked, status: event.target.checked ? 'active' : form.status })}
              className="h-5 w-5 accent-primary"
            />
            <span className="font-semibold text-on-surface">Đặt làm mặc định</span>
          </label>
        </div>
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Tài khoản mặc định sẽ tự chuyển sang trạng thái hoạt động và được ưu tiên khi tạo yêu cầu rút tiền.
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
