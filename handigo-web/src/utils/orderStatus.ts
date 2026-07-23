/**
 * Trạng thái đơn dịch vụ: nhãn tiếng Việt + tông màu, một nguồn duy nhất.
 *
 * Trước đây bốn nơi tự dịch trạng thái sang tiếng Việt với chữ khác nhau, nên
 * cùng một đơn hiển thị khác nhau tuỳ trang người dùng đang đứng:
 *
 *   | mã            | trang thợ (home) | trang thợ (đơn) | lịch sử khách | chi tiết đơn |
 *   | created       | Đang chờ         | Chờ xử lý       | Đang xử lý    | Chờ xử lý    |
 *   | accepted      | Đã nhận          | Đã nhận         | Đã chấp nhận  | Đã xác nhận  |
 *   | in_progress   | Đang làm         | Đang làm        | Đang thực hiện| Đang thực hiện|
 *   | completed     | Hoàn tất         | Hoàn tất        | Đã hoàn thành | Đã hoàn thành|
 *
 * Bộ chữ dưới đây lấy theo bản của trang lịch sử đơn — bản khách hàng nhìn thấy
 * nhiều nhất và đầy đủ nghĩa hơn các bản rút gọn.
 *
 * Tông màu tham chiếu `statusTone.ts` để chip trạng thái trong bảng, viền thẻ
 * đơn và màu series trên biểu đồ luôn khớp nhau.
 */
import type { Order } from '@/types/booking';
import type { StatusTone } from './statusTone';

export type OrderStatus = Order['status'];

export const orderStatusLabels: Record<OrderStatus, string> = {
  created: 'Đang xử lý',
  accepted: 'Đã chấp nhận',
  in_progress: 'Đang thực hiện',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
};

export const orderStatusTones: Record<OrderStatus, StatusTone> = {
  created: 'warning',
  accepted: 'brand',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Thứ tự hiển thị cố định — dùng cho bộ lọc và cho thứ tự series trên biểu đồ. */
export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'created',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
];

const isOrderStatus = (value: string): value is OrderStatus =>
  Object.hasOwn(orderStatusLabels, value);

/**
 * Nhận cả mã lạ (dữ liệu cũ trong DB, trạng thái backend thêm sau) và lùi về
 * tông trung tính kèm chính mã đó làm nhãn, thay vì ném lỗi hoặc hiện ô trống.
 */
export const getOrderStatusMeta = (
  status?: string | null,
): { label: string; tone: StatusTone } => {
  if (status && isOrderStatus(status)) {
    return { label: orderStatusLabels[status], tone: orderStatusTones[status] };
  }
  return { label: status || 'Không rõ', tone: 'neutral' };
};
