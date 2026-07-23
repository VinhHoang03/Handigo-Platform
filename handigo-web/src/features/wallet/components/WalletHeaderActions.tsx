import { Link } from 'react-router-dom';
import { Banknote, CreditCard, Landmark } from "lucide-react";

interface WalletHeaderActionsProps {
  isProvider: boolean;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
}

export function WalletHeaderActions({ isProvider, onOpenDeposit, onOpenWithdraw }: WalletHeaderActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onOpenDeposit}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
      >
        <CreditCard aria-hidden="true" size={20} />
        Nạp ví
      </button>
      <Link
        to={isProvider ? '/provider/bank-accounts' : '/customer/bank-accounts'}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
      >
        <Landmark aria-hidden="true" size={20} />
        Tài khoản ngân hàng
      </Link>
      <button
        type="button"
        onClick={onOpenWithdraw}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
      >
        <Banknote aria-hidden="true" size={20} />
        Rút tiền
      </button>
    </div>
  );
}
