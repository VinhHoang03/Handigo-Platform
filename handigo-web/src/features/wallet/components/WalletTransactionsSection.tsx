import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { Pagination } from '@/components/common/Pagination';
import { Skeleton } from '@/components/common/Skeleton';
import { walletApi } from '../api/wallet.api';
import type { WalletTransaction, WalletTransactionQuery } from '../types/wallet.types';
import { transactionLabels, getErrorMessage } from './wallet-formatters';
import { WalletTransactionTable } from './WalletTransactionTable';

export interface WalletSectionHandle {
  refresh: () => Promise<void>;
}

interface WalletTransactionsSectionProps {
  onError: (message: string) => void;
  ref?: Ref<WalletSectionHandle>;
}

const transactionsSkeleton = (
  <div className="space-y-3">
    {Array.from({ length: 5 }, (_, index) => (
      <div key={index} className="flex items-center gap-6 py-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20" rounded="rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    ))}
  </div>
);

/** Lịch sử giao dịch ví: tự quản lý query/phân trang, cha chỉ nhận lỗi qua onError. */
export function WalletTransactionsSection({ onError, ref }: WalletTransactionsSectionProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [query, setQuery] = useState<WalletTransactionQuery>({ page: 1, limit: 8, type: '' });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await walletApi.listTransactions({ ...query, type: query.type || undefined });
      setTransactions(result.items);
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
          <h2 className="text-title-lg font-bold text-on-surface">Lịch sử giao dịch</h2>
          <p className="text-sm text-on-surface-variant">Các biến động số dư ví theo thời gian gần nhất.</p>
        </div>
        <select
          value={query.type || ''}
          onChange={(event) => setQuery({ ...query, type: event.target.value as WalletTransactionQuery['type'], page: 1 })}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả loại giao dịch</option>
          {Object.entries(transactionLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <AsyncState loading={loading} error="" empty={!transactions.length} emptyMessage="Chưa có giao dịch ví." skeleton={transactionsSkeleton}>
        <WalletTransactionTable items={transactions} />
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery({ ...query, page })} />
    </section>
  );
}
