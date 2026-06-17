import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { voucherApi } from '../api/voucher.api';
import type { Voucher, VoucherDiscountType, VoucherPayload, VoucherQuery, VoucherStatus } from '../types/voucher.types';

type VoucherFormState = {
  code: string;
  name: string;
  description: string;
  discountType: VoucherDiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  usageLimit: string;
  startAt: string;
  endAt: string;
  status: Exclude<VoucherStatus, 'EXPIRED'>;
};

const emptyForm: VoucherFormState = {
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  usageLimit: '',
  startAt: '',
  endAt: '',
  status: 'ACTIVE',
};

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

const toLocalInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoString = (value: string) => new Date(value).toISOString();
const optionalNumber = (value: string) => (value.trim() === '' ? null : Number(value));

const statusValue = (voucher: Voucher) => {
  if (voucher.status === 'ACTIVE') return 'active';
  if (voucher.status === 'EXPIRED') return 'expired';
  return 'inactive';
};

const discountText = (voucher: Voucher) =>
  voucher.discountType === 'PERCENT'
    ? `${voucher.discountValue}%${voucher.maxDiscountAmount ? ` tối đa ${money.format(voucher.maxDiscountAmount)}` : ''}`
    : money.format(voucher.discountValue);

const buildPayload = (form: VoucherFormState): VoucherPayload => ({
  code: form.code.trim().toUpperCase(),
  name: form.name.trim() || form.code.trim().toUpperCase(),
  description: form.description.trim() || null,
  discountType: form.discountType,
  discountValue: Number(form.discountValue),
  maxDiscountAmount: optionalNumber(form.maxDiscountAmount),
  minOrderAmount: optionalNumber(form.minOrderAmount),
  usageLimit: optionalNumber(form.usageLimit),
  startAt: toIsoString(form.startAt),
  endAt: toIsoString(form.endAt),
  status: form.status,
});

export default function AdminPromotionsPage() {
  const [query, setQuery] = useState<VoucherQuery>({ page: 1, limit: 10, search: '', status: '' });
  const [items, setItems] = useState<Voucher[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<VoucherFormState>(emptyForm);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        ...query,
        search: query.search?.trim() || undefined,
        status: query.status || undefined,
      };
      const result = await voucherApi.list(params);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === 'ACTIVE' && item.isActive).length;
    const inactive = items.filter((item) => item.status === 'INACTIVE' || !item.isActive).length;
    const used = items.reduce((total, item) => total + item.usedCount, 0);
    return { active, inactive, used };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalMode('create');
  };

  const openEdit = (voucher: Voucher) => {
    setEditing(voucher);
    setForm({
      code: voucher.code,
      name: voucher.name,
      description: voucher.description || '',
      discountType: voucher.discountType,
      discountValue: String(voucher.discountValue),
      maxDiscountAmount: voucher.maxDiscountAmount == null ? '' : String(voucher.maxDiscountAmount),
      minOrderAmount: voucher.minOrderAmount == null ? '' : String(voucher.minOrderAmount),
      usageLimit: voucher.usageLimit == null ? '' : String(voucher.usageLimit),
      startAt: toLocalInputValue(voucher.startAt),
      endAt: toLocalInputValue(voucher.endAt),
      status: voucher.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
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
      if (modalMode === 'edit' && editing) await voucherApi.update(editing.id, payload);
      else await voucherApi.create(payload);
      setModalMode(null);
      setEditing(null);
      setNotice(modalMode === 'edit' ? 'Đã cập nhật voucher.' : 'Đã tạo voucher mới.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (toggleTarget.isActive && toggleTarget.status === 'ACTIVE') await voucherApi.disable(toggleTarget.id);
      else await voucherApi.enable(toggleTarget.id);
      setNotice('Đã cập nhật trạng thái voucher.');
      setToggleTarget(null);
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
      await voucherApi.delete(deleteTarget.id);
      setNotice('Đã xóa voucher.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Quản lý khuyến mãi</h1>
            <p className="text-on-surface-variant">Tạo mã voucher, cấu hình điều kiện áp dụng và theo dõi lượt sử dụng.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Tạo voucher
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon="local_offer" label="Đang hoạt động" value={stats.active} />
          <Stat icon="pause_circle" label="Tạm dừng" value={stats.inactive} />
          <Stat icon="confirmation_number" label="Lượt đã dùng" value={stats.used} />
        </div>

        {(notice || error) && <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>{error || notice}</div>}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative w-full lg:max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                value={query.search || ''}
                onChange={(event) => setQuery({ ...query, search: event.target.value, page: 1 })}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Tìm theo mã, tên hoặc mô tả..."
              />
            </label>
            <div className="flex gap-3">
              <select
                value={query.status || ''}
                onChange={(event) => setQuery({ ...query, status: event.target.value as VoucherQuery['status'], page: 1 })}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Tạm dừng</option>
                <option value="EXPIRED">Hết hạn</option>
              </select>
              <button onClick={() => void load()} className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant hover:bg-surface-container-low" aria-label="Tải lại">
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </div>

          <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Chưa có voucher phù hợp." onRetry={load}>
            <VoucherTable items={items} onEdit={openEdit} onDelete={setDeleteTarget} onToggle={setToggleTarget} />
          </AsyncState>
          <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery({ ...query, page })} />
        </section>
      </div>

      <VoucherModal open={Boolean(modalMode)} mode={modalMode || 'create'} form={form} busy={busy} onChange={setForm} onClose={() => setModalMode(null)} onSubmit={save} />
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.isActive && toggleTarget.status === 'ACTIVE' ? 'Tạm dừng voucher' : 'Kích hoạt voucher'}
        message={`Bạn có chắc chắn muốn ${toggleTarget?.isActive && toggleTarget.status === 'ACTIVE' ? 'tạm dừng' : 'kích hoạt'} voucher "${toggleTarget?.code || ''}"?`}
        busy={busy}
        onCancel={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa voucher"
        message={`Bạn có chắc chắn muốn xóa voucher "${deleteTarget?.code || ''}"? Thao tác này sẽ ẩn voucher khỏi danh sách quản lý.`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-headline-md font-bold">{value}</p>
      </div>
    </div>
  );
}

function VoucherTable({
  items,
  onEdit,
  onDelete,
  onToggle,
}: {
  items: Voucher[];
  onEdit: (voucher: Voucher) => void;
  onDelete: (voucher: Voucher) => void;
  onToggle: (voucher: Voucher) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left">
        <thead className="border-b border-outline-variant/20 text-sm uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="pb-4 font-semibold">Voucher</th>
            <th className="pb-4 font-semibold">Giảm giá</th>
            <th className="pb-4 font-semibold">Đơn tối thiểu</th>
            <th className="pb-4 font-semibold">Sử dụng</th>
            <th className="pb-4 font-semibold">Thời gian</th>
            <th className="pb-4 font-semibold">Trạng thái</th>
            <th className="pb-4 text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {items.map((voucher) => (
            <tr key={voucher.id} className="hover:bg-surface-container-low">
              <td className="py-4">
                <div>
                  <p className="font-semibold text-on-surface">{voucher.name}</p>
                  <p className="mt-1 inline-flex rounded-lg bg-primary/10 px-2 py-1 font-mono text-sm font-semibold text-primary">{voucher.code}</p>
                  {voucher.description && <p className="mt-2 max-w-sm truncate text-sm text-on-surface-variant">{voucher.description}</p>}
                </div>
              </td>
              <td className="py-4 font-medium">{discountText(voucher)}</td>
              <td className="py-4">{voucher.minOrderAmount == null ? '-' : money.format(voucher.minOrderAmount)}</td>
              <td className="py-4">
                {voucher.usedCount}
                {voucher.usageLimit == null ? '' : `/${voucher.usageLimit}`}
              </td>
              <td className="py-4 text-sm text-on-surface-variant">
                <p>{dateTime.format(new Date(voucher.startAt))}</p>
                <p>{dateTime.format(new Date(voucher.endAt))}</p>
              </td>
              <td className="py-4"><StatusBadge value={statusValue(voucher)} /></td>
              <td className="py-4 text-right">
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(voucher)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Sửa voucher">
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button onClick={() => onToggle(voucher)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high" aria-label="Đổi trạng thái voucher">
                    <span className="material-symbols-outlined text-[20px]">{voucher.isActive && voucher.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}</span>
                  </button>
                  <button onClick={() => onDelete(voucher)} className="rounded-lg p-2 text-error hover:bg-error/10" aria-label="Xóa voucher">
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

function VoucherModal({
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
  form: VoucherFormState;
  busy: boolean;
  onChange: (form: VoucherFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal open={open} title={mode === 'edit' ? 'Sửa voucher' : 'Tạo voucher'} onClose={onClose} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Mã voucher" required value={form.code} onChange={(value) => onChange({ ...form, code: value.toUpperCase() })} />
          <FormInput label="Tên hiển thị" value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        </div>
        <FormTextArea label="Mô tả" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Loại giảm giá</span>
            <select value={form.discountType} onChange={(event) => onChange({ ...form, discountType: event.target.value as VoucherDiscountType })} className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30">
              <option value="PERCENT">Phần trăm</option>
              <option value="AMOUNT">Số tiền</option>
            </select>
          </label>
          <FormInput label="Giá trị" type="number" required value={form.discountValue} onChange={(value) => onChange({ ...form, discountValue: value })} />
          <FormInput label="Giảm tối đa" type="number" value={form.maxDiscountAmount} onChange={(value) => onChange({ ...form, maxDiscountAmount: value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Đơn tối thiểu" type="number" value={form.minOrderAmount} onChange={(value) => onChange({ ...form, minOrderAmount: value })} />
          <FormInput label="Giới hạn lượt dùng" type="number" value={form.usageLimit} onChange={(value) => onChange({ ...form, usageLimit: value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label="Bắt đầu" type="datetime-local" required value={form.startAt} onChange={(value) => onChange({ ...form, startAt: value })} />
          <FormInput label="Kết thúc" type="datetime-local" required value={form.endAt} onChange={(value) => onChange({ ...form, endAt: value })} />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Trạng thái</span>
            <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as VoucherFormState['status'] })} className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30">
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm dừng</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
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
        min={type === 'number' ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function FormTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}
