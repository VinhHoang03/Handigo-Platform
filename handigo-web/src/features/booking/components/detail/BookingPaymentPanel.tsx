import { Modal } from "@/components/common/Modal";
import { WalletBalanceText } from "@/features/wallet/components/WalletBalanceText";
import type { Order } from "@/types/booking";
import { formatCurrency } from "./bookingDetailFormatters";
import {
  initialPaymentMethods,
  type InitialPaymentMethod,
} from "./bookingDetailConstants";

type BookingPaymentPanelProps = {
  order: Order;
  busy: boolean;
  canMakeInitialPayment: boolean;
  canChangePayment: boolean;
  quotationAmount?: number;
  paymentError: string | null;
  paymentMethodModalOpen: boolean;
  initialPaymentMethod: InitialPaymentMethod;
  onChangeMethod: (method: InitialPaymentMethod) => void;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onSubmitPayment: () => void;
};

/**
 * Nhắc thanh toán và chọn phương thức trước khi xác nhận đã thu tiền.
 */
export const BookingPaymentPanel = ({
  order,
  busy,
  canMakeInitialPayment,
  canChangePayment,
  quotationAmount,
  paymentError,
  paymentMethodModalOpen,
  initialPaymentMethod,
  onChangeMethod,
  onOpenModal,
  onCloseModal,
  onSubmitPayment,
}: BookingPaymentPanelProps) => (
  <>
    {(canMakeInitialPayment || canChangePayment) && (
      <div className={canChangePayment ? "mb-lg" : "mb-lg rounded-2xl border border-warning/30 bg-warning-container p-md text-sm text-on-warning-container"}>
        <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
          {!canChangePayment && <div>
            <p className="font-bold">
              {order.bookingStatus === "awaiting_payment"
                ? "Chuyên gia đã nhận lịch"
                : "Đơn hàng đang chờ thanh toán"}
            </p>
            <p className="mt-1">
              {order.bookingStatus === "awaiting_payment"
                ? `Thanh toán trước ${order.paymentDueAt
                    ? new Date(order.paymentDueAt).toLocaleString("vi-VN")
                    : "thời hạn giữ lịch"} để xác nhận lịch hẹn.`
                : "Bạn có thể tiếp tục thanh toán để hoàn tất đơn hàng này."}
            </p>
          </div>}
          <button
            type="button"
            disabled={busy}
            onClick={onOpenModal}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary disabled:opacity-60"
          >
            {busy
              ? "Đang xử lý..."
              : canChangePayment ? "Đổi phương thức thanh toán" : order.bookingStatus === "awaiting_payment"
                ? "Thanh toán giữ lịch"
                : "Tiếp tục thanh toán"}
          </button>
        </div>
        {paymentError && <p className="mt-sm font-medium text-error">{paymentError}</p>}
      </div>
    )}

    {paymentMethodModalOpen && (canMakeInitialPayment || canChangePayment) && (
      <Modal
        open
        title="Chọn phương thức thanh toán"
        onClose={onCloseModal}
        size="sm"
        closeOnEsc={!busy}
        closeOnOverlayClick={!busy}
      >
        <div className="space-y-md">
          <p className="text-sm text-on-surface-variant">
            Chọn phương thức bạn muốn dùng để thanh toán đơn #{order.orderCode}.
          </p>
          {canChangePayment && (
            <div className="rounded-xl bg-surface-container-low p-3 text-sm">
              <p className="font-bold text-on-surface">Số tiền: {formatCurrency(quotationAmount ?? order.pricing.totalPaidAmount)}</p>
              <p className="mt-1 text-on-surface-variant">{quotationAmount !== undefined
                ? "Thanh toán phần còn lại theo báo giá sau khi trừ cọc. Chỉ xác nhận nếu bạn chưa trả trực tiếp cho thợ."
                : "Giữ nguyên giá và voucher của đơn. Chỉ xác nhận nếu bạn chưa trả tiền mặt cho chuyên gia."}</p>
            </div>
          )}
          <div className="space-y-3">
            {initialPaymentMethods
              .filter((method) => !order.inspectionRequired || method.value !== "CASH")
              .filter((method) => !canChangePayment || method.value !== "CASH")
              .map((method) => (
                <label
                  key={method.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="retry-payment-method"
                    value={method.value}
                    checked={initialPaymentMethod === method.value}
                    onChange={() => onChangeMethod(method.value)}
                    disabled={busy}
                    className="h-5 w-5"
                  />
                  <method.icon aria-hidden="true" size={24} className="text-primary" />
                  <span>
                    <span className="block font-bold text-on-surface">{method.title}</span>
                    <span className="text-sm text-on-surface-variant">{method.description}</span>
                    {method.value === "WALLET" && <WalletBalanceText />}
                  </span>
                </label>
              ))}
          </div>
          {paymentError && (
            <p role="alert" className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">
              {paymentError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCloseModal}
              disabled={busy}
              className="btn-secondary"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={onSubmitPayment}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Đang xử lý..." : "Tiếp tục thanh toán"}
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>
);
