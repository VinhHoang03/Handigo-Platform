import { Wallet } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { WalletBalanceText } from "@/features/wallet/components/WalletBalanceText";
import { formatCurrency } from "./bookingDetailFormatters";
import type { useBookingQuotationPayment } from "./useBookingQuotationPayment";

export function BookingQuotationWalletPayment({ flow, busy }: {
  flow: ReturnType<typeof useBookingQuotationPayment>; busy: boolean;
}) {
  return <>
    {flow.canPay && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-on-surface">Bạn muốn thanh toán bằng ví?</p>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">Dùng Ví Handigo thay cho trả trực tiếp. Tiền cọc đã được khấu trừ.</p>
      </div>
      <button type="button" onClick={flow.open} disabled={busy} className="btn-primary shrink-0 gap-2">
        <Wallet aria-hidden="true" size={18} />Thanh toán bằng ví
      </button>
    </div>}
    <Modal open={Boolean(flow.confirmation)} onClose={flow.close} title="Thanh toán báo giá bằng ví" size="sm"
      closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      {flow.confirmation && <div className="space-y-4">
        <div className="rounded-2xl bg-primary/5 p-4">
          <p className="text-sm text-on-surface-variant">Số tiền còn lại sau khi trừ cọc</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(flow.confirmation.amount)}</p>
          <div className="mt-2"><WalletBalanceText /></div>
        </div>
        <p className="text-sm leading-6 text-on-surface-variant">Số tiền này sẽ được trừ từ Ví Handigo của bạn. Chỉ tiếp tục nếu bạn chưa trả khoản này trực tiếp cho thợ.</p>
        {flow.error && <p role="alert" className="rounded-xl bg-error/5 p-3 text-sm text-error">{flow.error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={flow.close} className="btn-secondary">Quay lại</button>
          <button type="button" disabled={busy} onClick={() => void flow.pay()} className="btn-primary">
            {busy ? "Đang thanh toán…" : "Xác nhận thanh toán"}
          </button>
        </div>
      </div>}
    </Modal>
  </>;
}
