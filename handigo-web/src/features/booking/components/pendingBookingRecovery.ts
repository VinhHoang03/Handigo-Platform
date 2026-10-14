import { bookingApi } from '../api/booking.api';
import type { Order } from '../../../types/booking';

export const PENDING_ORDER_ID_KEY = 'pendingBookingOrderId';
export const PENDING_ORDER_FINGERPRINT_KEY = 'pendingBookingFingerprint';
export const PENDING_ORDER_VOUCHER_KEY = 'pendingBookingVoucherCode';

export const clearPendingBooking = () => {
  sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
  sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
  sessionStorage.removeItem(PENDING_ORDER_VOUCHER_KEY);
};

type RecoveryResult = { paidOrder?: Order; voucherCode?: string };
const recoveries = new Map<string, Promise<RecoveryResult>>();
const isPaid = (order: Order) => order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid';

const recover = async (orderId: string): Promise<RecoveryResult> => {
  let order: Order | undefined;
  try {
    order = await bookingApi.getOrderById(orderId);
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
  }
  if (order && isPaid(order)) return { paidOrder: order };
  try {
    await bookingApi.discardUnpaidOrder(orderId);
  } catch (error) {
    // PayOS có thể vừa nhận tiền trong lúc khách quay lại hoặc hủy QR.
    const current = await bookingApi.getOrderById(orderId).catch(() => undefined);
    if (current && isPaid(current)) return { paidOrder: current };
    throw error;
  }
  return { voucherCode: order?.voucherSnapshot?.code };
};

/** Gộp các lần khôi phục cùng đơn để tránh chạy trùng khi trang được mở lại. */
export const recoverPendingBooking = async (orderId: string) => {
  const existing = recoveries.get(orderId);
  if (existing) return existing;
  const task = recover(orderId);
  recoveries.set(orderId, task);
  try {
    return await task;
  } finally {
    if (recoveries.get(orderId) === task) recoveries.delete(orderId);
  }
};
