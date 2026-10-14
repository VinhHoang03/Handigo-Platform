import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { bookingApi } from "@/features/booking/api/booking.api";
import { tokenStorage } from "@/api/tokenStorage";
import { getErrorMessage } from "@/utils/apiError";
import type { Order } from "@/types/booking";
import type { InitialPaymentMethod } from "./bookingDetailConstants";

/**
 * ⚠️ Luồng thanh toán ban đầu (PayOS/Ví/Tiền mặt) — đụng tiền.
 * Giữ nguyên logic tạo payment, điều hướng PayOS, điều kiện được phép thanh toán.
 */
export const useBookingPaymentFlow = (
  order: Order | null,
  busy: boolean,
  setBusy: (busy: boolean) => void,
) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [paymentError, setPaymentError] = useToastFeedback<string | null>(null, "error");
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [initialPaymentMethod, setInitialPaymentMethod] =
    useState<InitialPaymentMethod>("PAYOS");

  const openInitialPaymentModal = () => {
    if (!order) return;
    const currentMethod: InitialPaymentMethod =
      order.paymentMethod === "bank"
        ? "PAYOS"
        : order.paymentMethod === "wallet"
          ? "WALLET"
          : order.inspectionRequired
            ? "PAYOS"
            : "CASH";
    setInitialPaymentMethod(currentMethod);
    setPaymentError(null);
    setPaymentMethodModalOpen(true);
  };

  const closeInitialPaymentModal = () => {
    if (!busy) setPaymentMethodModalOpen(false);
  };

  const handleInitialPayment = async () => {
    if (
      !order ||
      order.paymentStatus !== "unpaid" ||
      order.paymentMethod === "cash" ||
      !["created", "accepted"].includes(order.status) ||
      !["not_required", "awaiting_payment"].includes(order.bookingStatus || "")
    ) return;

    try {
      setBusy(true);
      setPaymentError(null);
      const detailUrl = `${window.location.origin}/customer/bookings/result?orderId=${order._id}`;
      const result = await bookingApi.createPayment({
        orderId: order._id,
        method: initialPaymentMethod,
        paymentType: order.inspectionRequired ? "INSPECTION_DEPOSIT" : "FULL",
        returnUrl: `${detailUrl}&payos=success`,
        cancelUrl: `${detailUrl}&payos=cancel`,
      });

      if (initialPaymentMethod === "PAYOS" && result.payment.status !== "paid") {
        if (!result.checkoutUrl) {
          throw new Error("PayOS không trả về liên kết thanh toán.");
        }
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
