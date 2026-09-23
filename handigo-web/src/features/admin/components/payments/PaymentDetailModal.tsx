import { Modal } from "@/components/common/Modal";
import type { AdminPayment } from "../../types/adminOperations.types";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  RETRYABLE_REFUND_STATUSES,
  paymentDateTime,
  paymentMoney,
} from "./payment-constants";

interface PaymentDetailModalProps {
  payment: AdminPayment | null;
  loading: boolean;
  retryingRefund: boolean;
  onRetryRefund: () => void;
  onClose: () => void;
}

/** Ô trống hiển thị chuỗi rõ nghĩa thay vì dấu gạch. */
const orEmpty = (value?: string | null) => value || "Chưa có";

export function PaymentDetailModal({
  payment,
  loading,
  retryingRefund,
  onRetryRefund,
  onClose,
}: PaymentDetailModalProps) {
  const fields = payment
    ? [
        { label: "Trạng thái", value: PAYMENT_STATUS_LABELS[payment.status] },
        { label: "Số tiền", value: paymentMoney.format(payment.amount) },
        { label: "Phương thức", value: PAYMENT_METHOD_LABELS[payment.method] },
        { label: "Loại thanh toán", value: PAYMENT_TYPE_LABELS[payment.paymentType] },
        { label: "Payment ID", value: payment._id },
        { label: "Order ID", value: String(payment.orderId) },
        { label: "Customer ID", value: String(payment.customerId) },
        { label: "Mã giao dịch", value: orEmpty(payment.transactionCode) },
        { label: "Gateway order code", value: orEmpty(payment.gatewayOrderCode) },
        { label: "Gateway transaction ID", value: orEmpty(payment.gatewayTransactionId) },
        { label: "Tạo lúc", value: paymentDateTime.format(new Date(payment.createdAt)) },
        {
          label: "Thanh toán lúc",
          value: payment.paidAt ? paymentDateTime.format(new Date(payment.paidAt)) : "Chưa thanh toán",
        },
      ]
    : [];

  const refund = payment?.metadata?.refund;
  const canRetryRefund = RETRYABLE_REFUND_STATUSES.includes(refund?.status || "");

  return (
    <Modal
      open={Boolean(payment) || loading}
      title="Chi tiết giao dịch"
      onClose={onClose}
      size="lg"
    >
      {loading && !payment ? (
        <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div>
      ) : payment ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">{field.label}</p>
              <p className="mt-1 break-all font-semibold">{field.value}</p>
            </div>
          ))}

          {refund && (
            <div className="rounded-xl bg-primary/10 p-4 text-sm text-primary sm:col-span-2">
              <p className="font-bold">
                Hoàn {refund.rate ?? 100}% · {paymentMoney.format(refund.amount ?? payment.amount)}
              </p>
              <p className="mt-1">Trạng thái đối soát: {refund.status || "đang xử lý"}</p>
              {canRetryRefund && (
                <button
                  type="button"
                  onClick={onRetryRefund}
                  disabled={retryingRefund}
                  className="mt-3 rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary disabled:opacity-50"
                >
                  {retryingRefund ? "Đang xử lý..." : "Thử hoàn tiền lại"}
                </button>
              )}
            </div>
          )}

          {(payment.failureReason || payment.refundReason) && (
            <div className="rounded-xl bg-error/10 p-4 text-sm text-error sm:col-span-2">
              {payment.failureReason || payment.refundReason}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
