import { toneChipClasses } from '@/utils/statusTone';
import type { WalletTransaction } from '../types/wallet.types';
import { dateTime, getStatusTone, money, transactionLabels, transactionStatusLabel } from './wallet-formatters';

export function WalletTransactionTable({ items }: { items: WalletTransaction[] }) {
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
              <td className={`py-4 font-bold tabular-nums ${item.direction === 'in' ? 'text-success' : 'text-error'}`}>
                {item.direction === 'in' ? '+' : '-'}{money.format(item.amount)}
              </td>
              <td className="py-4 tabular-nums">{money.format(item.balanceAfter)}</td>
              <td className="py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneChipClasses[getStatusTone(item.status)]}`}>
                  {transactionStatusLabel(item.status)}
                </span>
              </td>
              <td className="py-4 text-sm text-on-surface-variant">{dateTime.format(new Date(item.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
