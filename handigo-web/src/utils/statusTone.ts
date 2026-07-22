/**
 * Tông màu trạng thái dùng chung toàn nền tảng.
 *
 * Trước đây mỗi nơi tự dựng bảng màu riêng bằng palette mặc định của Tailwind
 * (emerald/amber/red/blue/violet...), nên "đã hoàn thành" ở trang này không
 * cùng màu với "đã hoàn thành" ở trang khác, và không có gì ràng buộc chúng với
 * design token. Tất cả nay quy về một bộ tông ngữ nghĩa.
 */

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';

/** Chip nền đặc nhạt — dùng cho nhãn trạng thái không viền. */
export const toneChipClasses: Record<StatusTone, string> = {
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  brand: 'bg-primary/10 text-primary',
};

/** Biến thể có viền — dùng khi nhãn nằm trên nền đã có màu. */
export const toneOutlineClasses: Record<StatusTone, string> = {
  success: 'border-success/30 bg-success/8 text-on-success-container',
  warning: 'border-warning/30 bg-warning/8 text-on-warning-container',
  error: 'border-error/30 bg-error/8 text-error',
  info: 'border-secondary/30 bg-secondary/8 text-on-secondary-container',
  neutral: 'border-outline-variant bg-surface-container-high text-on-surface-variant',
  brand: 'border-primary/30 bg-primary/8 text-primary',
};

/** Màu chữ đơn sắc — dùng cho số liệu, icon, chữ nhấn. */
export const toneTextClasses: Record<StatusTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-secondary',
  neutral: 'text-on-surface-variant',
  brand: 'text-primary',
};

/** Trạng thái đơn hàng của Handigo quy về tông tương ứng. */
export const ORDER_STATUS_TONES: Record<string, StatusTone> = {
  created: 'warning',
  pending: 'warning',
  accepted: 'brand',
  in_progress: 'info',
  active: 'info',
  completed: 'success',
  cancelled: 'error',
};

export const getOrderStatusTone = (status?: string): StatusTone =>
  (status && ORDER_STATUS_TONES[status]) || 'neutral';
