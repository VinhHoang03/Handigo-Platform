import { bookingApi } from '../api/booking.api';
import type { Order } from '../../../types/booking';
import { getBookingSessionRevision } from '../utils/bookingSessionStorage';
export { PENDING_ORDER_ID_KEY, PENDING_ORDER_FINGERPRINT_KEY, PENDING_ORDER_VOUCHER_KEY,
  clearPendingBooking } from '../utils/bookingSessionStorage';

type RecoveryResult = { paidOrder?: Order; voucherCode?: string };
const recoveries = new Map<string, Promise<RecoveryResult>>();
const isPaid = (order: Order) => order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid';

const recover = async (orderId: string, revision: number): Promise<RecoveryResult> => {
  const assertSession = () => {
    if (revision !== getBookingSessionRevision()) throw new Error('Phiên đặt dịch vụ đã thay đổi.');
  };
  let order: Order | undefined;
  try {
    order = await bookingApi.getOrderById(orderId);
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
  }
  assertSession();
  if (order && isPaid(order)) return { paidOrder: order };
  try {
    await bookingApi.discardUnpaidOrder(orderId);
  } catch (error) {
    // PayOS có thể vừa nhận tiền trong lúc khách quay lại hoặc hủy QR.
    assertSession();
    const current = await bookingApi.getOrderById(orderId).catch(() => undefined);
    assertSession();
    if (current && isPaid(current)) return { paidOrder: current };
    throw error;
  }
  assertSession();
  return { voucherCode: order?.voucherSnapshot?.code };
};

/** Gộp các lần khôi phục cùng đơn để tránh chạy trùng khi trang được mở lại. */
export const recoverPendingBooking = async (orderId: string) => {
  const revision = getBookingSessionRevision();
  const key = `${revision}:${orderId}`;
  const existing = recoveries.get(key);
  if (existing) return existing;
  const task = recover(orderId, revision);
  recoveries.set(key, task);
  try {
    return await task;
  } finally {
    if (recoveries.get(key) === task) recoveries.delete(key);
  }
};
