import type { Order, OrderQuotation } from '@/types/booking';

/** Chỉ khấu trừ tiền cọc khách đã thanh toán khỏi báo giá sửa chữa. */
export function getAppliedQuotationDeposit(order: Order, paidDepositAmount = 0) {
  if (order.pricing.baseAmount !== undefined) {
    const paidAmount = order.depositPaidAt ? order.pricing.totalPaidAmount : paidDepositAmount;
    return Math.max(paidAmount, 0);
  }
  return order.depositPaidAt
    ? Math.max(paidDepositAmount, order.depositAmount || 0)
    : paidDepositAmount;
}

export function getDirectRepairPayment(quotationAmount: number, depositAmount: number) {
  return Math.max(quotationAmount - depositAmount, 0);
}

export function isQuotationPaidOnline(
  order: Pick<Order, 'paymentStatus' | 'paymentMethod'>,
  quotation?: Pick<OrderQuotation['quotation'], 'directPaymentConfirmedAt'> | null,
) {
  return Boolean(quotation && !quotation.directPaymentConfirmedAt
    && order.paymentStatus === 'paid' && ['wallet', 'bank'].includes(order.paymentMethod));
}

export function getRemainingQuotationPayment(
  quotation: OrderQuotation['quotation'], depositAmount: number, orderStatus?: Order['status'], paidOnline = false,
) {
  if (paidOnline || orderStatus === 'cancelled' || ['rejected', 'cancelled', 'expired'].includes(quotation.status)) return 0;
  const confirmedAmount = quotation.directPaymentConfirmedAt ? quotation.directPaymentConfirmedAmount ?? 0 : 0;
  return Math.max(getDirectRepairPayment(quotation.finalAmount, depositAmount) - confirmedAmount, 0);
}
