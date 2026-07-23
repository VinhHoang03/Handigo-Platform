import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardShell } from '@/components/common/DashboardShell';
import { walletApi } from '../api/wallet.api';
import type { WalletOverview, WalletSummary } from '../types/wallet.types';
import { WalletAmountModal } from '../components/WalletAmountModal';
import { WalletHeaderActions } from '../components/WalletHeaderActions';
import { WalletStatsCards } from '../components/WalletStatsCards';
import { WalletTransactionsSection, type WalletSectionHandle } from '../components/WalletTransactionsSection';
import { WalletWithdrawalsSection } from '../components/WalletWithdrawalsSection';
import { getErrorMessage } from '../components/wallet-formatters';
import { useWalletAmountForms } from '../components/useWalletAmountForms';
import { useWalletDepositReturn } from '../components/useWalletDepositReturn';

type WalletRole = 'CUSTOMER' | 'PROVIDER';

export function WalletPage({ role }: { role: WalletRole }) {
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const transactionsRef = useRef<WalletSectionHandle>(null);
  const withdrawalsRef = useRef<WalletSectionHandle>(null);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

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
    await Promise.all([loadOverview(), transactionsRef.current?.refresh(), withdrawalsRef.current?.refresh()]);
  }, [loadOverview]);

  useWalletDepositReturn({ refreshAll, setError, setNotice });

  const forms = useWalletAmountForms({ isProvider, walletBalance: wallet?.balance, refreshAll, setError, setNotice });

  return (
    <DashboardShell role={role}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Ví Handigo</h1>
            <p className="text-on-surface-variant">Theo dõi số dư, nạp ví, gửi yêu cầu rút tiền và lịch sử giao dịch của bạn.</p>
          </div>
          <WalletHeaderActions isProvider={isProvider} onOpenDeposit={forms.openDeposit} onOpenWithdraw={forms.openWithdraw} />
        </div>

        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>{error || notice}</div>
        )}

        <WalletStatsCards stats={stats} loading={loading} error={error && !wallet ? error : ''} onRetry={refreshAll} />

        <WalletTransactionsSection ref={transactionsRef} onError={setError} />

        <WalletWithdrawalsSection ref={withdrawalsRef} onError={setError} />
      </div>

      <WalletAmountModal
        open={forms.depositOpen}
        title="Nạp ví"
        amount={forms.depositAmount}
        busy={forms.busy}
        submitLabel="Tạo liên kết thanh toán"
        helper="Bạn sẽ được chuyển sang cổng PayOS để hoàn tất giao dịch."
        error={forms.depositError}
        onAmountChange={forms.changeDepositAmount}
        onClose={forms.closeDeposit}
        onSubmit={forms.submitDeposit}
      />

      <WalletAmountModal
        open={forms.withdrawOpen}
        title="Rút tiền"
        amount={forms.withdrawAmount}
        busy={forms.busy}
        submitLabel="Gửi yêu cầu"
        helper="Hệ thống sẽ dùng tài khoản ngân hàng mặc định hoặc tài khoản mới nhất trong hồ sơ của bạn."
        maxAmount={wallet?.balance}
        error={forms.withdrawError}
        onAmountChange={forms.changeWithdrawAmount}
        onClose={forms.closeWithdraw}
        onSubmit={forms.submitWithdrawal}
      />
    </DashboardShell>
  );
}
