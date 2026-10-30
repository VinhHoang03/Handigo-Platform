import type { IOrder } from "../models/order.model";
import { AppError } from "./appError";

export const CUSTOMER_NO_SHOW_WAIT_MINUTES = 10;
export const CUSTOMER_NO_SHOW_COMPENSATION = 5_000;
export const CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS = 200;
// Áp dụng thời gian chờ 10 phút và mốc lịch hẹn theo quy tắc chính thức.
export const CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING = false;
// Tạm cho phép dùng lại ảnh khi kiểm thử; đổi về false để bật lại kiểm tra nội dung ảnh trùng.
export const CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING = true;

export const assertCustomerNoShowWait = (
  order: Pick<IOrder, "arrival" | "providerId" | "orderType" | "scheduledAt">,
  now = Date.now(),
  waitMinutes = CUSTOMER_NO_SHOW_WAIT_MINUTES,
) => {
  if (!order.arrival || String(order.arrival.providerId) !== String(order.providerId)) {
    throw new AppError("Vui lòng xác nhận đã đến nơi trước khi báo khách không có mặt.", 409);
  }
  if (CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING) return;
  const scheduledAt = ["scheduled", "recurring"].includes(order.orderType) ? order.scheduledAt?.getTime() ?? 0 : 0;
  const waitStartedAt = Math.max(order.arrival.arrivedAt.getTime(), scheduledAt);
  const remaining = waitStartedAt + waitMinutes * 60_000 - now;
  if (remaining > 0) {
    throw new AppError(`Bạn cần chờ thêm ${Math.ceil(remaining / 60_000)} phút trước khi báo khách không có mặt. Vui lòng tiếp tục gọi hoặc nhắn tin cho khách.`, 409);
  }
};
