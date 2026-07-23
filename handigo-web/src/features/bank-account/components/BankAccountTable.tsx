import type { BankAccount } from '../types/bankAccount.types';
import { maskAccountNumber } from './bankAccountConstants';

export function BankAccountTable({
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
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${account.status === 'active' ? 'bg-success-container text-on-success-container' : 'bg-warning-container text-on-warning-container'}`}>
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
