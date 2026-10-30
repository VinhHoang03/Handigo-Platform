import { useState } from "react";
import { getAppliedQuotationDeposit, getRemainingQuotationPayment, isQuotationPaidOnline } from '@/utils/quotationPayment';
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
  const appliedDepositAmount = order ? getAppliedQuotationDeposit(order, paidDepositAmount) : paidDepositAmount;
  const remainingQuotationAmount = quotation
    ? getRemainingQuotationPayment(quotation.quotation, appliedDepositAmount, order?.status,
      order ? isQuotationPaidOnline(order, quotation.quotation) : false)
    : 0;
  const canPayQuotation = Boolean(order?.inspectionRequired && order.status === "completed" && order.depositPaidAt
    && order.paymentStatus === "partially_paid" && quotation && !quotation.quotation.directPaymentConfirmedAt
    && (quotation.quotation.status === "saved" || (quotation.quotation.status === "approved" && quotation.quotation.customerConfirmed))
    && remainingQuotationAmount > 0);
  const canChangePayment = canPayQuotation || Boolean(order && !order.inspectionRequired &&
    order.status === "in_progress" && order.paymentStatus === "unpaid" &&
    !payments.some((payment) => payment.paymentType === "full" && payment.status === "paid"));
  const paymentFlow = useBookingPaymentFlow(order, busy, setBusy, canChangePayment, data.updateOrder,
    canPayQuotation && quotation ? { quotation, amount: remainingQuotationAmount } : undefined);

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
    canPayQuotation,
    cancellationFlow,
    reassignmentFlow,
    providerInfo,
    hasSuccessfulPayment,
    paymentStatusDisplay,
    paidDepositAmount,
    appliedDepositAmount,
    remainingQuotationAmount,
    canMakeInitialPayment,
    canChangePayment,
    timeline,
  };
};
