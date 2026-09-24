import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { Pagination } from '@/components/common/Pagination';
import { Skeleton } from '@/components/common/Skeleton';
import { walletApi } from '../api/wallet.api';
import type { WithdrawalQuery, WithdrawalRequest } from '../types/wallet.types';
import { getErrorMessage } from './wallet-formatters';
import { WalletWithdrawalTable } from './WalletWithdrawalTable';
import type { WalletSectionHandle } from './WalletTransactionsSection';

interface WalletWithdrawalsSectionProps {
  onError: (message: string) => void;
  ref?: Ref<WalletSectionHandle>;
}

const withdrawalsSkeleton = (
  <div className="space-y-3">
    {Array.from({ length: 4 }, (_, index) => (
      <div key={index} className="flex items-center gap-6 py-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20" rounded="rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    ))}
  </div>
);

/** Yêu cầu rút tiền: tự quản lý query/phân trang, cha chỉ nhận lỗi qua onError. */
export function WalletWithdrawalsSection({ onError, ref }: WalletWithdrawalsSectionProps) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [query, setQuery] = useState<WithdrawalQuery>({ page: 1, limit: 5, status: '' });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await walletApi.listWithdrawals({ ...query, status: query.status || undefined });
      setWithdrawals(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query, onError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-title-lg font-bold text-on-surface">Yêu cầu rút tiền</h2>
          <p className="text-sm text-on-surface-variant">Theo dõi trạng thái duyệt và tài khoản nhận tiền.</p>
        </div>
        <select
          value={query.status || ''}
          onChange={(event) => setQuery({ ...query, status: event.target.value as WithdrawalQuery['status'], page: 1 })}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </select>
      </div>

      <AsyncState loading={loading} error="" empty={!withdrawals.length} emptyMessage="Chưa có yêu cầu rút tiền." skeleton={withdrawalsSkeleton}>
        <WalletWithdrawalTable items={withdrawals} />
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery({ ...query, page })} />
    </section>
  );
}
