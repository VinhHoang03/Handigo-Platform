import type { Order } from '@/types/booking';

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
