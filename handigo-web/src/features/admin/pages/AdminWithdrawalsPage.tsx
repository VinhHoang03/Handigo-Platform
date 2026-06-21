import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, RefreshCw, X } from 'lucide-react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FloatingTextarea } from '@/components/common/FloatingField';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { adminApi } from '../api/admin.api';
import type { AdminQuery, AdminWithdrawal, WithdrawalStatus } from '../types/admin.types';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const statusLabels: Record<WithdrawalStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const statusClass: Record<WithdrawalStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const filterOptions: Array<{ label: string; value: WithdrawalStatus | '' }> = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ duyệt', value: 'pending' },
  { label: 'Lịch sử đã duyệt', value: 'approved' },
  { label: 'Từ chối', value: 'rejected' },
];

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu.';
};

const bankText = (withdrawal: AdminWithdrawal) => {
  const bank = withdrawal.bankAccountId;
  if (!bank || typeof bank === 'string') return 'Chưa có thông tin tài khoản';
  return `${bank.bankName} - ${bank.accountNumber}`;
};

function StatusPill({ status }: { status: WithdrawalStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-3">
      <p className="text-xs font-semibold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10, status: '' });
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AdminWithdrawal | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.withdrawals({
        ...query,
        status: query.status || undefined,
      });
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const stats = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const activeFilter = filterOptions.find((option) => option.value === (query.status || ''));
    return [
      { label: 'Số yêu cầu', value: items.length.toLocaleString('vi-VN') },
      { label: 'Tổng tiền', value: money.format(totalAmount) },
      { label: 'Danh sách', value: activeFilter?.label || 'Tất cả' },
    ];
  }, [items, query.status]);

  const closeModal = () => {
    setSelected(null);
    setAction(null);
    setAdminNote('');
  };

  const submitReview = async () => {
    if (!selected || !action) return;

    try {
      setBusy(true);
      setError('');
      setNotice('');
      if (action === 'approve') {
        await adminApi.approveWithdrawal(selected._id, adminNote.trim() || undefined);
        setNotice('Đã duyệt yêu cầu rút tiền.');
      } else {
        await adminApi.rejectWithdrawal(selected._id, adminNote.trim() || undefined);
        setNotice('Đã từ chối yêu cầu rút tiền và hoàn tiền về ví.');
      }
      closeModal();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header>
        <h1 className="text-headline-lg font-bold">Duyệt rút tiền</h1>
        <p className="text-on-surface-variant">
          Kiểm tra tài khoản nhận tiền, xử lý yêu cầu chờ duyệt và xem lịch sử các đơn đã duyệt.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
            <p className="text-sm text-on-surface-variant">{item.label}</p>
            <p className="mt-1 text-title-lg font-bold text-on-surface">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const active = (query.status || '') === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => setQuery({ ...query, status: option.value, page: 1 })}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-primary text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]'
                    : 'border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </section>

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Không có yêu cầu rút tiền phù hợp."
        onRetry={load}
      >
        <div className="overflow-x-auto border-b border-outline-variant/40">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="p-4">Nhà cung cấp</th>
                <th className="p-4">Tài khoản nhận</th>
                <th className="p-4">Số tiền</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-t border-outline-variant/30">
                  <td className="p-4">
                    <p className="font-semibold">{item.userId.fullName}</p>
                    <p className="text-sm text-on-surface-variant">{item.userId.email}</p>
                  </td>
                  <td className="p-4">{bankText(item)}</td>
                  <td className="p-4 font-bold">{money.format(item.amount)}</td>
                  <td className="p-4">{dateTime.format(new Date(item.createdAt))}</td>
                  <td className="p-4"><StatusPill status={item.status} /></td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        title="Xem chi tiết"
                        onClick={() => setSelected(item)}
                        className="rounded-lg border border-outline-variant p-2 text-primary"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={totalPages}
        onChange={(page) => setQuery({ ...query, page })}
      />

      <Modal open={Boolean(selected)} title="Chi tiết yêu cầu rút tiền" onClose={closeModal} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Nhà cung cấp" value={selected.userId.fullName} />
              <Info label="Email" value={selected.userId.email} />
              <Info label="Số tiền" value={money.format(selected.amount)} />
              <Info label="Trạng thái" value={statusLabels[selected.status]} />
              <Info label="Ngày tạo" value={dateTime.format(new Date(selected.createdAt))} />
              <Info label="Ngày xử lý" value={selected.reviewedAt ? dateTime.format(new Date(selected.reviewedAt)) : 'Chưa xử lý'} />
            </div>

            <section className="rounded-lg border border-outline-variant/40 p-4">
              <h3 className="font-bold">Tài khoản ngân hàng</h3>
              {typeof selected.bankAccountId === 'object' && selected.bankAccountId ? (
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p><b>Ngân hàng:</b> {selected.bankAccountId.bankName}</p>
                  <p><b>Mã ngân hàng:</b> {selected.bankAccountId.bankCode}</p>
                  <p><b>Số tài khoản:</b> {selected.bankAccountId.accountNumber}</p>
                  <p><b>Chủ tài khoản:</b> {selected.bankAccountId.accountHolderName}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Chưa có thông tin tài khoản nhận.</p>
              )}
            </section>

            {selected.adminNote && (
              <p className="rounded-lg bg-surface-container-low p-3 text-sm">
                <b>Ghi chú admin:</b> {selected.adminNote}
              </p>
            )}

            {selected.status === 'pending' && (
              <div className="space-y-3">
                {action && (
                  <FloatingTextarea
                    id="withdrawal-admin-note"
                    label="Ghi chú xử lý"
                    value={adminNote}
                    rows={4}
                    onValueChange={setAdminNote}
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAction(action === 'reject' ? null : 'reject')}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error disabled:opacity-50"
                  >
                    <X size={18} /> Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => (action === 'approve' ? void submitReview() : setAction('approve'))}
                    disabled={busy}
                    className="btn-primary"
                  >
                    <Check size={18} /> {busy ? 'Đang xử lý...' : action === 'approve' ? 'Xác nhận duyệt' : 'Duyệt'}
                  </button>
                </div>
                {action === 'reject' && (
                  <button
                    type="button"
                    onClick={() => void submitReview()}
                    disabled={busy}
                    className="w-full rounded-lg bg-error py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
