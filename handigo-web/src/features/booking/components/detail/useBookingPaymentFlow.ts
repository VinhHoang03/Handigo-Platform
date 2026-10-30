import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { bookingApi } from "@/features/booking/api/booking.api";
import { tokenStorage } from "@/api/tokenStorage";
import { getErrorMessage } from "@/utils/apiError";
import type { Order, OrderQuotation } from "@/types/booking";
import type { InitialPaymentMethod } from "./bookingDetailConstants";

/**
 * Thanh toán ban đầu và đổi phương thức cho khoản dịch vụ chưa thu tiền.
 */
export const useBookingPaymentFlow = (
  order: Order | null,
  busy: boolean,
  setBusy: (busy: boolean) => void,
  canChangePayment: boolean,
  updateOrder: (order: Order) => void,
  quotationPayment?: { quotation: OrderQuotation; amount: number },
) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [paymentError, setPaymentError] = useToastFeedback<string | null>(null, "error");
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const pending = useRef(false);
  const [confirmation, setConfirmation] = useState<{ quotationId: string; revision: number; amount: number } | null>(null);
  const [initialPaymentMethod, setInitialPaymentMethod] =
    useState<InitialPaymentMethod>("PAYOS");

  const openInitialPaymentModal = () => {
    if (!order || busy || pending.current) return;
    setConfirmation(quotationPayment ? { quotationId: quotationPayment.quotation.quotation._id,
      revision: quotationPayment.quotation.quotation.revision ?? 0, amount: quotationPayment.amount } : null);
    const currentMethod: InitialPaymentMethod =
      order.paymentMethod === "bank"
        ? "PAYOS"
        : order.paymentMethod === "wallet"
          ? "WALLET"
          : order.inspectionRequired || canChangePayment
            ? "PAYOS"
            : "CASH";
    setInitialPaymentMethod(currentMethod);
    setPaymentError(null);
    setPaymentMethodModalOpen(true);
  };

  const closeInitialPaymentModal = () => {
    if (!busy && !pending.current) setPaymentMethodModalOpen(false);
  };

  const handleInitialPayment = async () => {
    if (
      busy || pending.current || !order ||
      (!quotationPayment && order.paymentStatus !== "unpaid") ||
      (!canChangePayment && (order.paymentMethod === "cash" ||
      !["created", "accepted"].includes(order.status) ||
      !["not_required", "awaiting_payment"].includes(order.bookingStatus || "")))
    ) return;

    if (quotationPayment && (!confirmation || confirmation.quotationId !== quotationPayment.quotation.quotation._id
      || confirmation.revision !== (quotationPayment.quotation.quotation.revision ?? 0) || confirmation.amount !== quotationPayment.amount)) {
      setPaymentError("Báo giá đã thay đổi. Vui lòng đóng cửa sổ và kiểm tra lại.");
      return;
    }
    if (quotationPayment && initialPaymentMethod === "CASH") return;

    try {
      pending.current = true;
      setBusy(true);
      setPaymentError(null);
      const detailUrl = `${window.location.origin}/customer/bookings/result?orderId=${order._id}`;
      const result = await bookingApi.createPayment({
        orderId: order._id,
        expectedAmount: confirmation?.amount ?? (canChangePayment ? order.pricing.totalPaidAmount : undefined),
        quotationId: confirmation?.quotationId,
        expectedRevision: confirmation?.revision,
        method: initialPaymentMethod,
        paymentType: quotationPayment ? "REMAINING" : order.inspectionRequired ? "INSPECTION_DEPOSIT" : "FULL",
        returnUrl: `${detailUrl}&payos=success`,
        cancelUrl: `${window.location.origin}/customer/bookings/${order._id}?payos=cancel`,
      });

      if (initialPaymentMethod === "PAYOS" && result.payment.status !== "paid") {
        if (!result.checkoutUrl) {
          throw new Error("PayOS không trả về liên kết thanh toán.");
        }
        const latestOrder = await bookingApi.getOrderById(order._id);
        // Cập nhật trang trước khi rời đi để lịch sử trình duyệt không giữ phương thức cũ.
        flushSync(() => {
          updateOrder(latestOrder);
          setPaymentMethodModalOpen(false);
        });
        tokenStorage.prepareExternalRedirect();
        window.location.assign(result.checkoutUrl);
        return;
      }
      setPaymentMethodModalOpen(false);
      addToast(result.payment.status === "paid" && result.payment.method === "payos" && initialPaymentMethod !== "PAYOS"
        ? "Giao dịch PayOS đã thanh toán thành công. Hệ thống không thu thêm tiền."
        : "Đã ghi nhận phương thức thanh toán.", "success");
      navigate(`/customer/bookings/result?orderId=${order._id}`);
    } catch (error) {
      console.error("Không thể tiếp tục thanh toán đơn hàng:", error);
      setPaymentError(
        getErrorMessage(
          error,
          "Không thể tiếp tục thanh toán. Vui lòng tải lại trang và thử lại.",
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return {
    paymentError,
    paymentMethodModalOpen,
    initialPaymentMethod,
    setInitialPaymentMethod,
    openInitialPaymentModal,
    closeInitialPaymentModal,
    handleInitialPayment,
  };
};
