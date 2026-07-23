import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBookingDetailData } from "./useBookingDetailData";
import { useMatchingCountdown } from "./useMatchingCountdown";
import { useBookingPaymentFlow } from "./useBookingPaymentFlow";
import { useBookingCancellationFlow } from "./useBookingCancellationFlow";
import { useBookingReassignmentFlow } from "./useBookingReassignmentFlow";
import { buildOrderTimeline } from "./bookingDetailTimeline";
import { getPaymentStatusDisplay } from "./bookingDetailFormatters";
import { getProviderInfo } from "./bookingDetailProvider";

/**
 * Hook điều phối toàn bộ trang chi tiết đơn hàng: gộp các hook con (tải dữ
 * liệu, đếm ngược, thanh toán, hủy/hoàn tiền, đổi kỹ thuật viên) và tính các
 * giá trị dẫn xuất dùng chung. Tất cả action dùng chung một cờ `busy` như bản
 * gốc để khoá đồng thời các nút thao tác.
 */
export const useBookingDetail = () => {
  const { bookingId: id } = useParams();
  const [busy, setBusy] = useState(false);

  const data = useBookingDetailData(id);
  const { order, quotation, payments, recurringOrders, loadData } = data;

  const { isWaitingForProvider, matchingSecondsRemaining } =
    useMatchingCountdown(order);

  const paymentFlow = useBookingPaymentFlow(order, busy, setBusy, loadData);
  const cancellationFlow = useBookingCancellationFlow(
    order,
    quotation,
    busy,
    setBusy,
    loadData,
  );
  const reassignmentFlow = useBookingReassignmentFlow(
    order,
    data.setOrder,
    data.reassignmentModalOpen,
    data.setReassignmentModalOpen,
    busy,
    setBusy,
    loadData,
  );

  const providerInfo = order ? getProviderInfo(order) : null;
  const hasSuccessfulPayment = order
    ? ["paid", "partially_paid"].includes(order.paymentStatus)
    : false;
  const hasPaidInitialPayment = payments.some(
    (payment) =>
      payment.status === "paid" &&
      ["full", "inspection_deposit"].includes(payment.paymentType),
  );
  const quotationPhaseStarted = Boolean(
    order?.inspectionRequired &&
      (order.hasAdditionalQuotation || Boolean(quotation)),
  );
  const paymentStatusDisplay = order
    ? getPaymentStatusDisplay(order, hasPaidInitialPayment)
    : null;
  const paidDepositAmount = payments
    .filter(
      (payment) =>
        payment.status === "paid" &&
        payment.paymentType === "inspection_deposit",
    )
    .reduce((total, payment) => total + payment.amount, 0);
  // Đơn đã ghi nhận `depositPaidAt` thì lấy mức cọc lớn hơn giữa khoản đã thu và
  // mức cọc của đơn — tránh hụt khi bản ghi payment chưa khớp đủ.
  const appliedDepositAmount = order?.depositPaidAt
    ? Math.max(paidDepositAmount, order.depositAmount || 0)
    : paidDepositAmount;
  const remainingQuotationAmount = quotation
    ? Math.max(quotation.quotation.finalAmount - appliedDepositAmount, 0)
    : 0;
  const canMakeInitialPayment = Boolean(
    order &&
      !hasPaidInitialPayment &&
      !quotationPhaseStarted &&
      order.paymentStatus === "unpaid" &&
      order.paymentMethod !== "cash" &&
      ["created", "accepted"].includes(order.status) &&
      ["not_required", "awaiting_payment"].includes(order.bookingStatus || ""),
  );
  const timeline = order ? buildOrderTimeline(order) : [];

  return {
    ...data,
    recurringOrders,
    busy,
    isWaitingForProvider,
    matchingSecondsRemaining,
    paymentFlow,
    cancellationFlow,
    reassignmentFlow,
    providerInfo,
    hasSuccessfulPayment,
    paymentStatusDisplay,
    paidDepositAmount,
    appliedDepositAmount,
    remainingQuotationAmount,
    canMakeInitialPayment,
    timeline,
  };
};
