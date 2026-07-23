import { toneChipClasses } from '@/utils/statusTone';
import type { WithdrawalRequest } from '../types/wallet.types';
import { bankText, dateTime, getStatusTone, money, withdrawalLabels } from './wallet-formatters';

export function WalletWithdrawalTable({ items }: { items: WithdrawalRequest[] }) {
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
              <td className="py-4 font-bold tabular-nums text-on-surface">{money.format(item.amount)}</td>
              <td className="py-4 text-sm text-on-surface-variant">{bankText(item)}</td>
              <td className="py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneChipClasses[getStatusTone(item.status)]}`}>
                  {withdrawalLabels[item.status]}
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
