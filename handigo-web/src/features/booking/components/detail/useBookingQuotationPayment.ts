import { useRef, useState } from "react";
import { useToast, useToastFeedback } from "@/components/common/Toast";
import { bookingApi } from "../../api/booking.api";
import type { Order, OrderQuotation } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";

export const useBookingQuotationPayment = (order: Order | null, quotation: OrderQuotation | null,
  amount: number, busy: boolean, setBusy: (value: boolean) => void, reload: () => Promise<void>) => {
  const { addToast } = useToast();
  const [confirmation, setConfirmation] = useState<{ quotationId: string; revision: number; amount: number } | null>(null);
  const [error, setError] = useToastFeedback<string>("", "error");
  const pending = useRef(false);
  const canPay = Boolean(order?.inspectionRequired && order.status === "completed" && order.depositPaidAt
    && order.paymentStatus === "partially_paid" && quotation && !quotation.quotation.directPaymentConfirmedAt
    && (quotation.quotation.status === "saved" || (quotation.quotation.status === "approved" && quotation.quotation.customerConfirmed))
    && amount > 0);
  const open = () => {
    if (!canPay || busy || !quotation) return;
    setError("");
    setConfirmation({ quotationId: quotation.quotation._id, revision: quotation.quotation.revision ?? 0, amount });
  };
  const close = () => { if (!busy && !pending.current) setConfirmation(null); };
  const pay = async () => {
    if (!order || !confirmation || busy || pending.current) return;
    if (!canPay || confirmation.quotationId !== quotation?.quotation._id
      || confirmation.revision !== (quotation.quotation.revision ?? 0) || confirmation.amount !== amount) {
      setError("Báo giá hoặc trạng thái thanh toán đã thay đổi. Vui lòng đóng cửa sổ và kiểm tra lại."); return;
    }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await bookingApi.createPayment({ orderId: order._id, method: "WALLET", paymentType: "REMAINING",
        expectedAmount: confirmation.amount, quotationId: confirmation.quotationId, expectedRevision: confirmation.revision });
      if (result.payment.status !== "paid") throw new Error("Chưa xác nhận được thanh toán báo giá. Vui lòng tải lại đơn hàng.");
      setConfirmation(null);
      addToast("Đã thanh toán báo giá bằng Ví Handigo.", "success");
      await reload();
    } catch (failure) {
      setError(getErrorMessage(failure, "Chưa thanh toán được báo giá bằng ví. Vui lòng thử lại."));
    } finally { pending.current = false; setBusy(false); }
  };
  return { canPay, confirmation, error, open, close, pay };
};
