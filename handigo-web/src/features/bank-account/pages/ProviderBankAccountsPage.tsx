import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { bankAccountApi } from '../api/bankAccount.api';
import type { BankAccount, BankAccountPayload, BankAccountStatus } from '../types/bankAccount.types';

type BankAccountForm = {
  bankMode: 'list' | 'custom';
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
  status: BankAccountStatus;
};

const emptyForm: BankAccountForm = {
  bankMode: 'list',
  bankName: '',
  bankCode: '',
  accountNumber: '',
  accountHolderName: '',
  isDefault: false,
  status: 'active',
};

const vietnamBanks = [
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { code: 'ICB', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { code: 'VBA', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội', shortName: 'MBBank' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh', shortName: 'HDBank' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', shortName: 'MSB' },
  { code: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB' },
  { code: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', shortName: 'Eximbank' },
  { code: 'LPB', name: 'Ngân hàng TMCP Lộc Phát Việt Nam', shortName: 'LPBank' },
  { code: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á', shortName: 'SeABank' },
  { code: 'NAB', name: 'Ngân hàng TMCP Nam Á', shortName: 'Nam A Bank' },
  { code: 'PVCB', name: 'Ngân hàng TMCP Đại Chúng Việt Nam', shortName: 'PVcomBank' },
  { code: 'SCB', name: 'Ngân hàng TMCP Sài Gòn', shortName: 'SCB' },
  { code: 'ABB', name: 'Ngân hàng TMCP An Bình', shortName: 'ABBANK' },
  { code: 'BAB', name: 'Ngân hàng TMCP Bắc Á', shortName: 'Bac A Bank' },
  { code: 'BVB', name: 'Ngân hàng TMCP Bảo Việt', shortName: 'BaoVietBank' },
  { code: 'KLB', name: 'Ngân hàng TMCP Kiên Long', shortName: 'KienLongBank' },
  { code: 'NCB', name: 'Ngân hàng TMCP Quốc Dân', shortName: 'NCB' },
  { code: 'PGB', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển', shortName: 'PGBank' },
  { code: 'VAB', name: 'Ngân hàng TMCP Việt Á', shortName: 'VietABank' },
  { code: 'VIETBANK', name: 'Ngân hàng TMCP Việt Nam Thương Tín', shortName: 'VietBank' },
  { code: 'SHBVN', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', shortName: 'ShinhanBank' },
  { code: 'WVN', name: 'Ngân hàng TNHH MTV Woori Việt Nam', shortName: 'Woori' },
  { code: 'HSBC', name: 'Ngân hàng TNHH MTV HSBC Việt Nam', shortName: 'HSBC' },
  { code: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam', shortName: 'CIMB' },
  { code: 'UOB', name: 'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh', shortName: 'UOB' },
  { code: 'PBVN', name: 'Ngân hàng TNHH MTV Public Việt Nam', shortName: 'PublicBank' },
];

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

const maskAccountNumber = (value: string) => {
  if (value.length <= 4) return value;
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
};

const buildPayload = (form: BankAccountForm): BankAccountPayload => ({
  bankName: form.bankName.trim(),
  bankCode: form.bankCode.trim().toUpperCase(),
  accountNumber: form.accountNumber.trim(),
  accountHolderName: form.accountHolderName.trim().toUpperCase(),
  isDefault: form.isDefault,
  status: form.status,
});

export default function ProviderBankAccountsPage({ role = 'PROVIDER' }: { role?: 'CUSTOMER' | 'PROVIDER' }) {
  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<BankAccountForm>(emptyForm);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [defaultTarget, setDefaultTarget] = useState<BankAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await bankAccountApi.list());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === 'active').length;
    const inactive = items.filter((item) => item.status === 'inactive').length;
    const defaultAccount = items.find((item) => item.isDefault);
    return { total: items.length, active, inactive, defaultAccount };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, isDefault: items.length === 0 });
    setModalMode('create');
  };

  const openEdit = (account: BankAccount) => {
    const knownBank = vietnamBanks.some((bank) => bank.code === account.bankCode);
    setEditing(account);
    setForm({
      bankMode: knownBank ? 'list' : 'custom',
      bankName: account.bankName,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName,
      isDefault: account.isDefault,
      status: account.status,
    });
    setModalMode('edit');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = buildPayload(form);
      if (modalMode === 'edit' && editing) await bankAccountApi.update(editing._id, payload);
      else await bankAccountApi.create(payload);
      setModalMode(null);
      setEditing(null);
      setNotice(modalMode === 'edit' ? 'Đã cập nhật tài khoản ngân hàng.' : 'Đã thêm tài khoản ngân hàng.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetDefault = async () => {
    if (!defaultTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await bankAccountApi.setDefault(defaultTarget._id);
      setNotice('Đã đặt tài khoản mặc định.');
      setDefaultTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await bankAccountApi.delete(deleteTarget._id);
      setNotice('Đã xóa tài khoản ngân hàng.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role={role}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Tài khoản ngân hàng</h1>
            <p className="text-on-surface-variant">Quản lý tài khoản nhận tiền khi gửi yêu cầu rút ví Handigo.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
              Tải lại
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add_card</span>
              Thêm tài khoản
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat icon="account_balance" label="Tổng tài khoản" value={String(stats.total)} />
          <Stat icon="task_alt" label="Đang hoạt động" value={String(stats.active)} />
          <Stat icon="star" label="Mặc định" value={stats.defaultAccount?.bankCode || '-'} />
        </div>

        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">Danh sách tài khoản</h2>
              <p className="text-sm text-on-surface-variant">Tài khoản mặc định sẽ được dùng khi rút tiền nếu không chọn tài khoản cụ thể.</p>
            </div>
            {stats.inactive > 0 && (
              <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {stats.inactive} tài khoản tạm ngưng
              </span>
            )}
          </div>

          <AsyncState
            loading={loading}
            error={error && !items.length ? error : ''}
            empty={!items.length}
            emptyMessage="Chưa có tài khoản ngân hàng."
            onRetry={load}
          >
            <BankAccountTable
              items={items}
              onEdit={openEdit}
              onSetDefault={setDefaultTarget}
              onDelete={setDeleteTarget}
            />
          </AsyncState>
        </section>
      </div>

      <BankAccountModal
        open={Boolean(modalMode)}
        mode={modalMode || 'create'}
        form={form}
        busy={busy}
        onChange={setForm}
        onClose={() => setModalMode(null)}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(defaultTarget)}
        title="Đặt tài khoản mặc định"
        message={`Bạn có chắc chắn muốn đặt ${defaultTarget?.bankName || ''} - ${defaultTarget ? maskAccountNumber(defaultTarget.accountNumber) : ''} làm tài khoản mặc định?`}
        busy={busy}
        onCancel={() => setDefaultTarget(null)}
        onConfirm={confirmSetDefault}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa tài khoản ngân hàng"
        message={`Bạn có chắc chắn muốn xóa tài khoản ${deleteTarget?.bankName || ''} - ${deleteTarget ? maskAccountNumber(deleteTarget.accountNumber) : ''}?`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="truncate text-headline-md font-bold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function BankAccountTable({
  items,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  items: BankAccount[];
  onEdit: (account: BankAccount) => void;
  onSetDefault: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left">
        <thead className="border-b border-outline-variant/20 text-sm uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="pb-4 font-semibold">Ngân hàng</th>
            <th className="pb-4 font-semibold">Chủ tài khoản</th>
            <th className="pb-4 font-semibold">Số tài khoản</th>
            <th className="pb-4 font-semibold">Trạng thái</th>
            <th className="pb-4 text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {items.map((account) => (
            <tr key={account._id} className="hover:bg-surface-container-low">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant/20 bg-primary/10 font-bold text-primary">
                    {account.bankCode.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-on-surface">{account.bankName}</p>
                      {account.isDefault && (
                        <span className="inline-flex rounded-full bg-secondary-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">{account.bankCode}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 font-medium text-on-surface">{account.accountHolderName}</td>
              <td className="py-4 font-mono text-sm text-on-surface-variant">{maskAccountNumber(account.accountNumber)}</td>
              <td className="py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${account.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {account.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                </span>
              </td>
              <td className="py-4 text-right">
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(account)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Sửa tài khoản">
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button
                    onClick={() => onSetDefault(account)}
                    disabled={account.isDefault}
                    className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Đặt mặc định"
                  >
                    <span className="material-symbols-outlined text-[20px]">star</span>
                  </button>
                  <button onClick={() => onDelete(account)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa tài khoản">
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BankAccountModal({
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
