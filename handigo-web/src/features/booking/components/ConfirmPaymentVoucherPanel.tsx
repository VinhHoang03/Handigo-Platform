import type { AvailableVoucher } from '../types/voucher.types';

interface ConfirmPaymentVoucherPanelProps {
  voucherCode: string;
  onSelectVoucher: (code: string) => void;
  onManualInputChange: (value: string) => void;
  onApplyClick: () => void;
  availableVouchers: AvailableVoucher[];
  appliedVoucher: AvailableVoucher | null;
  onRemoveVoucher: () => void;
  voucherError: string;
  isSubmitting: boolean;
}

/** Chọn/nhập mã voucher trong thẻ tóm tắt đơn hàng ở bước xác nhận thanh toán. */
export const ConfirmPaymentVoucherPanel = ({
  voucherCode, onSelectVoucher, onManualInputChange, onApplyClick, availableVouchers,
  appliedVoucher, onRemoveVoucher, voucherError, isSubmitting,
}: ConfirmPaymentVoucherPanelProps) => (
  <div className="border-t border-dashed border-outline-variant pt-md">
    <label className="block text-sm font-semibold text-on-surface">
      Voucher
      <select
        value={voucherCode}
        onChange={(event) => onSelectVoucher(event.target.value)}
        disabled={isSubmitting}
        className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3"
      >
        <option value="">Không sử dụng voucher</option>
        {availableVouchers.map((voucher) => (
          <option key={voucher.id} value={voucher.code}>
            {voucher.code} · {voucher.discountType === 'PERCENT'
              ? `Giảm ${voucher.discountValue}%`
              : `Giảm ${voucher.discountValue.toLocaleString('vi-VN')}đ`}
          </option>
        ))}
      </select>
    </label>
    <div className="mt-2 flex gap-2">
      <input
        value={voucherCode}
        onChange={(event) => onManualInputChange(event.target.value.toUpperCase())}
        maxLength={50}
        disabled={isSubmitting}
        placeholder="Hoặc nhập mã voucher"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant px-3 uppercase"
      />
      <button
        type="button"
        onClick={onApplyClick}
        disabled={isSubmitting || !voucherCode.trim()}
        className="rounded-xl bg-primary px-3 font-semibold text-on-primary disabled:opacity-50"
      >
        Áp dụng
      </button>
    </div>
    {appliedVoucher && (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-success-container px-3 py-2 text-sm font-semibold text-on-success-container">
        <span>Đã áp dụng {appliedVoucher.code}</span>
        <button
          type="button"
          onClick={onRemoveVoucher}
          disabled={isSubmitting}
          className="underline"
        >
          Gỡ
        </button>
      </div>
    )}
    {voucherError && <p className="mt-2 text-sm font-medium text-error">{voucherError}</p>}
  </div>
);
