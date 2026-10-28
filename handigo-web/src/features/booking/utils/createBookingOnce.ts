import type { CreateOrderPayload } from '../api/booking.api';
import type { Order } from '@/types/booking';
import { BOOKING_CREATE_ATTEMPT_KEY } from './bookingSessionStorage';

/** Giữ nguyên lần xác nhận và nội dung khi chưa nhận được kết quả tạo đơn. */
export async function createBookingOnce(
  payload: CreateOrderPayload,
  send: (payload: CreateOrderPayload, requestId: string) => Promise<Order>,
) {
  const saved = sessionStorage.getItem(BOOKING_CREATE_ATTEMPT_KEY);
  const attempt: { requestId: string; payload: CreateOrderPayload } = saved
    ? JSON.parse(saved)
    : { requestId: crypto.randomUUID(), payload };
  const serializedAttempt = JSON.stringify(attempt);
  sessionStorage.setItem(BOOKING_CREATE_ATTEMPT_KEY, serializedAttempt);
  try {
    const order = await send(attempt.payload, attempt.requestId);
    if (JSON.stringify(attempt.payload) !== JSON.stringify(payload)) {
      throw Object.assign(new Error('Đơn của lần xác nhận trước đã được tạo. Vui lòng kiểm tra lại đơn trước khi thanh toán.'), {
        createdOrderId: order._id,
      });
    }
    return order;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    // Lỗi mạng/5xx chưa chứng minh server chưa tạo đơn: giữ khóa để đối soát.
    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429
      && sessionStorage.getItem(BOOKING_CREATE_ATTEMPT_KEY) === serializedAttempt) {
      sessionStorage.removeItem(BOOKING_CREATE_ATTEMPT_KEY);
    }
    throw error;
  }
}
