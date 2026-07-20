import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { walletApi } from '../api/wallet.api';
import type {
  WalletOverview,
  WalletSummary,
  WalletTransaction,
  WalletTransactionQuery,
  WalletTransactionType,
  WithdrawalQuery,
  WithdrawalRequest,
  WithdrawalStatus,
} from '../types/wallet.types';

type WalletRole = 'CUSTOMER' | 'PROVIDER';
type DepositForm = { amount: string };
type WithdrawForm = { amount: string };

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const PENDING_DEPOSIT_ORDER_CODE_KEY = 'handigo:pending-wallet-deposit-order-code';

const transactionLabels: Record<WalletTransactionType, string> = {
  deposit: 'Nạp ví',
  payment: 'Thanh toán',
  refund: 'Hoàn tiền',
  provider_earning: 'Thu nhập dịch vụ',
  platform_fee: 'Phí nền tảng',
  withdraw: 'Rút tiền',
  withdraw_rejected: 'Hoàn rút tiền',
  adjustment: 'Điều chỉnh',
};

const withdrawalLabels: Record<WithdrawalStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

const toneByStatus = (status: string) => {
  if (status === 'success' || status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

const transactionStatusLabel = (status: WalletTransaction['status']) => {
  if (status === 'success') return 'Thành công';
  if (status === 'failed') return 'Thất bại';
  if (status === 'cancelled') return 'Đã hủy';
  return 'Đang xử lý';
};

const bankText = (withdrawal: WithdrawalRequest) => {
  const bank = withdrawal.bankAccountId;
  if (!bank || typeof bank === 'string') return 'Tài khoản nhận mặc định';
  return `${bank.bankName} - ${bank.accountNumber}`;
};

const normalizeAmountInput = (value: string) => value.replace(/\D/g, '');

const parseAmount = (value: string) => {
  const normalized = normalizeAmountInput(value);
  return normalized ? Number(normalized) : 0;
};

export function WalletPage({ role }: { role: WalletRole }) {
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactionQuery, setTransactionQuery] = useState<WalletTransactionQuery>({ page: 1, limit: 8, type: '' });
  const [withdrawalQuery, setWithdrawalQuery] = useState<WithdrawalQuery>({ page: 1, limit: 5, status: '' });
  const [transactionPages, setTransactionPages] = useState(1);
  const [withdrawalPages, setWithdrawalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [withdrawalLoading, setWithdrawalLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositForm, setDepositForm] = useState<DepositForm>({ amount: '' });
  const [withdrawForm, setWithdrawForm] = useState<WithdrawForm>({ amount: '' });
  const handledDepositReturnRef = useRef(false);

  const isProvider = role === 'PROVIDER';

  const loadOverview = useCallback(async () => {
    try {
      const [walletResult, summaryResult] = await Promise.all([
        walletApi.getMine(),
        walletApi.getSummary(),
      ]);
      setWallet(walletResult);
      setSummary(summaryResult);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const result = await walletApi.listTransactions({
        ...transactionQuery,
        type: transactionQuery.type || undefined,
      });
      setTransactions(result.items);
      setTransactionPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTransactionLoading(false);
    }
  }, [transactionQuery]);

  const loadWithdrawals = useCallback(async () => {
    if (!isProvider) {
      setWithdrawalLoading(false);
      return;
    }

    try {
      const result = await walletApi.listWithdrawals({
        ...withdrawalQuery,
        status: withdrawalQuery.status || undefined,
      });
      setWithdrawals(result.items);
      setWithdrawalPages(result.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWithdrawalLoading(false);
    }
  }, [isProvider, withdrawalQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTransactions();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTransactions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWithdrawals();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWithdrawals]);

  const stats = useMemo(() => {
    const currentBalance = wallet?.balance ?? summary?.currentBalance ?? 0;

    if (!isProvider) {
      return [
        { icon: 'account_balance_wallet', label: 'Số dư khả dụng', value: currentBalance, strong: true },
        { icon: 'hourglass_top', label: 'Đang chờ xử lý', value: wallet?.pendingBalance ?? 0 },
        { icon: 'add_card', label: 'Tổng đã nạp', value: wallet?.totalDeposited ?? summary?.totalDeposited ?? 0 },
        { icon: 'receipt_long', label: 'Đã thanh toán', value: wallet?.totalPaid ?? summary?.totalPaid ?? 0 },
      ];
    }

    return [
      { icon: 'account_balance_wallet', label: 'Số dư khả dụng', value: currentBalance, strong: true },
      { icon: 'hourglass_top', label: 'Đang chờ xử lý', value: wallet?.pendingBalance ?? 0 },
      { icon: 'trending_up', label: 'Tổng thu nhập', value: wallet?.totalEarnings ?? summary?.totalEarnings ?? 0 },
      { icon: 'payments', label: 'Đã rút', value: wallet?.totalWithdrawn ?? summary?.totalWithdrawals ?? 0 },
    ];
  }, [isProvider, summary, wallet]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadTransactions(), loadWithdrawals()]);
  }, [loadOverview, loadTransactions, loadWithdrawals]);

  useEffect(() => {
    if (handledDepositReturnRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const walletDepositStatus = params.get('walletDeposit');
    const storedOrderCode = sessionStorage.getItem(PENDING_DEPOSIT_ORDER_CODE_KEY);
    const orderCode = params.get('orderCode') || storedOrderCode;

    if (!orderCode || (!walletDepositStatus && !storedOrderCode)) return;

    handledDepositReturnRef.current = true;
    if (walletDepositStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const syncDepositStatus = async () => {
      setError('');
      setNotice('');
      try {
        if (walletDepositStatus === 'cancelled') {
          await walletApi.cancelDeposit(orderCode);
          setNotice('Đã hủy giao dịch nạp ví.');
        } else {
          const transaction = await walletApi.syncDeposit(orderCode);
          if (transaction.status === 'success') {
            setNotice('Nạp ví thành công. Số dư đã được cập nhật.');
          } else {
            setNotice('Giao dịch nạp ví chưa được PayOS xác nhận, vui lòng kiểm tra lại sau.');
          }
        }
        sessionStorage.removeItem(PENDING_DEPOSIT_ORDER_CODE_KEY);
        await refreshAll();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };

    void syncDepositStatus();
  }, [refreshAll]);

  const submitDeposit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const amount = parseAmount(depositForm.amount);
      if (amount < 1) {
        setError('Số tiền phải lớn hơn hoặc bằng 1.');
        return;
      }
      const walletPath = isProvider ? '/provider/wallet' : '/customer/wallet';
      const result = await walletApi.createDeposit({
        amount,
        returnUrl: `${window.location.origin}${walletPath}`,
        cancelUrl: `${window.location.origin}${walletPath}`,
      });
      const orderCode = result.transaction.gatewayOrderCode || result.transaction.transactionCode;
      if (orderCode) {
        sessionStorage.setItem(PENDING_DEPOSIT_ORDER_CODE_KEY, orderCode);
      }
      setDepositOpen(false);
      setDepositForm({ amount: '' });
      setNotice('Đã tạo liên kết nạp ví. Bạn sẽ được chuyển sang cổng thanh toán.');
      await refreshAll();
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const amount = parseAmount(withdrawForm.amount);
      if (amount < 1) {
        setError('Số tiền rút phải lớn hơn hoặc bằng 1.');
        return;
      }
      if (wallet?.balance !== undefined && amount > wallet.balance) {
        setError('Số tiền rút không được vượt quá số dư khả dụng.');
        return;
      }
      await walletApi.createWithdrawal({ amount });
      setWithdrawOpen(false);
      setWithdrawForm({ amount: '' });
      setNotice('Đã gửi yêu cầu rút tiền. Số tiền được chuyển sang trạng thái chờ duyệt.');
      await refreshAll();
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
            <h1 className="text-headline-lg font-bold text-on-background">Ví Handigo</h1>
            <p className="text-on-surface-variant">{isProvider ? 'Theo dõi số dư, nạp ví và gửi yêu cầu rút tiền về tài khoản ngân hàng của bạn.' : 'Theo dõi số dư, nạp ví và lịch sử thanh toán dịch vụ của bạn.'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setDepositOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-[20px]">add_card</span>
              Nạp ví
            </button>
            {isProvider && (
              <button type="button" onClick={() => setWithdrawOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">payments</span>
                Rút tiền
              </button>
            )}
          </div>
        </div>

        {(notice || error) && <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>{error || notice}</div>}

        <AsyncState loading={loading} error={error && !wallet ? error : ''} empty={false} onRetry={refreshAll}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined block text-2xl leading-none">{item.icon}</span>
                </div>
                <p className="mt-4 text-sm text-on-surface-variant">{item.label}</p>
                <p className={`${item.strong ? 'text-headline-md' : 'text-title-lg'} mt-1 font-bold text-on-surface`}>{money.format(item.value)}</p>
              </div>
            ))}
          </div>
        </AsyncState>

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">Lịch sử giao dịch</h2>
              <p className="text-sm text-on-surface-variant">Các biến động số dư ví theo thời gian gần nhất.</p>
            </div>
            <select
              value={transactionQuery.type || ''}
              onChange={(event) => setTransactionQuery({ ...transactionQuery, type: event.target.value as WalletTransactionQuery['type'], page: 1 })}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả loại giao dịch</option>
              {Object.entries(transactionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <AsyncState loading={transactionLoading} error="" empty={!transactions.length} emptyMessage="Chưa có giao dịch ví.">
            <TransactionTable items={transactions} />
          </AsyncState>
          <Pagination page={transactionQuery.page || 1} totalPages={transactionPages} onChange={(page) => setTransactionQuery({ ...transactionQuery, page })} />
        </section>

        {isProvider && (
          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">Yêu cầu rút tiền</h2>
              <p className="text-sm text-on-surface-variant">Theo dõi trạng thái duyệt và tài khoản nhận tiền.</p>
            </div>
            <select
              value={withdrawalQuery.status || ''}
              onChange={(event) => setWithdrawalQuery({ ...withdrawalQuery, status: event.target.value as WithdrawalQuery['status'], page: 1 })}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              </select>
            </div>

            <AsyncState loading={withdrawalLoading} error="" empty={!withdrawals.length} emptyMessage="Chưa có yêu cầu rút tiền.">
              <WithdrawalTable items={withdrawals} />
            </AsyncState>
            <Pagination page={withdrawalQuery.page || 1} totalPages={withdrawalPages} onChange={(page) => setWithdrawalQuery({ ...withdrawalQuery, page })} />
          </section>
        )}
      </div>

      <AmountModal
        open={depositOpen}
        title="Nạp ví"
        amount={depositForm.amount}
        busy={busy}
        submitLabel="Tạo liên kết thanh toán"
        helper="Bạn sẽ được chuyển sang cổng PayOS để hoàn tất giao dịch."
        onAmountChange={(amount) => setDepositForm({ amount })}
        onClose={() => setDepositOpen(false)}
        onSubmit={submitDeposit}
      />

      {isProvider && (
        <AmountModal
        open={withdrawOpen}
        title="Rút tiền"
        amount={withdrawForm.amount}
        busy={busy}
        submitLabel="Gửi yêu cầu"
        helper="Hệ thống sẽ dùng tài khoản ngân hàng mặc định hoặc tài khoản mới nhất trong hồ sơ của bạn."
        maxAmount={wallet?.balance}
        onAmountChange={(amount) => setWithdrawForm({ amount })}
        onClose={() => setWithdrawOpen(false)}
        onSubmit={submitWithdrawal}
        />
      )}
    </DashboardShell>
  );
}

function TransactionTable({ items }: { items: WalletTransaction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="border-b border-outline-variant/20 text-sm uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="pb-4 font-semibold">Giao dịch</th>
            <th className="pb-4 font-semibold">Số tiền</th>
            <th className="pb-4 font-semibold">Số dư sau</th>
            <th className="pb-4 font-semibold">Trạng thái</th>
            <th className="pb-4 font-semibold">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {items.map((item) => (
            <tr key={item._id} className="hover:bg-surface-container-low">
              <td className="py-4">
                <p className="font-semibold text-on-surface">{transactionLabels[item.type]}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{item.description || item.transactionCode || 'Giao dịch ví'}</p>
              </td>
              <td className={`py-4 font-bold ${item.direction === 'in' ? 'text-emerald-700' : 'text-error'}`}>
                {item.direction === 'in' ? '+' : '-'}{money.format(item.amount)}
              </td>
              <td className="py-4">{money.format(item.balanceAfter)}</td>
              <td className="py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByStatus(item.status)}`}>{transactionStatusLabel(item.status)}</span>
              </td>
              <td className="py-4 text-sm text-on-surface-variant">{dateTime.format(new Date(item.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WithdrawalTable({ items }: { items: WithdrawalRequest[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="border-b border-outline-variant/20 text-sm uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="pb-4 font-semibold">Yêu cầu</th>
            <th className="pb-4 font-semibold">Số tiền</th>
            <th className="pb-4 font-semibold">Tài khoản nhận</th>
            <th className="pb-4 font-semibold">Trạng thái</th>
            <th className="pb-4 font-semibold">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {items.map((item) => (
            <tr key={item._id} className="hover:bg-surface-container-low">
              <td className="py-4">
                <p className="font-semibold text-on-surface">Rút tiền về ngân hàng</p>
                {item.adminNote && <p className="mt-1 text-sm text-on-surface-variant">{item.adminNote}</p>}
              </td>
              <td className="py-4 font-bold text-on-surface">{money.format(item.amount)}</td>
              <td className="py-4 text-sm text-on-surface-variant">{bankText(item)}</td>
              <td className="py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneByStatus(item.status)}`}>{withdrawalLabels[item.status]}</span>
              </td>
              <td className="py-4 text-sm text-on-surface-variant">{dateTime.format(new Date(item.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AmountModal({
  open,
  title,
  amount,
  busy,
  submitLabel,
  helper,
  maxAmount,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  amount: string;
  busy: boolean;
  submitLabel: string;
  helper: string;
  maxAmount?: number;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Số tiền</span>
          <input
            type="text"
            required
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(event) => onAmountChange(normalizeAmountInput(event.target.value))}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Nhập số tiền"
          />
        </label>
        {maxAmount !== undefined && (
          <p className="text-sm text-on-surface-variant">Số dư khả dụng: <span className="font-semibold text-on-surface">{money.format(maxAmount)}</span></p>
        )}
        <p className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">{helper}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang xử lý...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
