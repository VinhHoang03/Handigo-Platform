import type { Order } from '@/types/booking';

/** Chỉ khấu trừ cọc đã trả; phụ phí đặt ngay không nằm trong báo giá sửa chữa. */
export function getAppliedQuotationDeposit(order: Order, paidDepositAmount = 0) {
  if (order.pricing.baseAmount !== undefined) {
    const paidAmount = order.depositPaidAt ? order.pricing.totalPaidAmount : paidDepositAmount;
    return Math.max(paidAmount - (order.pricing.immediateFee ?? 0), 0);
  }
  return order.depositPaidAt
    ? Math.max(paidDepositAmount, order.depositAmount || 0)
    : paidDepositAmount;
}

export function getDirectRepairPayment(quotationAmount: number, depositAmount: number) {
  return Math.max(quotationAmount - depositAmount, 0);
}
