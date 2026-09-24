import type { FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { money, normalizeAmountInput } from './wallet-formatters';

interface WalletAmountModalProps {
  open: boolean;
  title: string;
  amount: string;
  busy: boolean;
  submitLabel: string;
  helper: string;
  maxAmount?: number;
  error?: string;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function WalletAmountModal({
  open,
  title,
  amount,
  busy,
  submitLabel,
  helper,
  maxAmount,
  error,
  onAmountChange,
  onClose,
  onSubmit,
}: WalletAmountModalProps) {
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
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'wallet-amount-error' : undefined}
            className={`w-full rounded-xl border bg-surface p-3 outline-none focus:ring-2 ${error ? 'border-error focus:ring-error/30' : 'border-outline-variant focus:ring-primary/30'}`}
            placeholder="Nhập số tiền"
          />
        </label>
        {error && <p id="wallet-amount-error" role="alert" className="text-sm font-medium text-error">{error}</p>}
        {maxAmount !== undefined && (
          <p className="text-sm text-on-surface-variant">
            Số dư khả dụng: <span className="font-semibold tabular-nums text-on-surface">{money.format(maxAmount)}</span>
          </p>
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
