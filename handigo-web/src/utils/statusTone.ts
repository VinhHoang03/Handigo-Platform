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

/**
 * Chỉ màu viền — dùng cho dải màu bên trái thẻ (`border-l-4`), nơi nền và chữ
 * đã có màu riêng nên không được đè thêm.
 */
export const toneBorderClasses: Record<StatusTone, string> = {
  success: 'border-success',
  warning: 'border-warning',
  error: 'border-error',
  info: 'border-secondary',
  neutral: 'border-outline-variant',
  brand: 'border-primary',
};

/*
 * `ORDER_STATUS_TONES` / `getOrderStatusTone` từng nằm ở đây nhưng không nơi nào
 * import — trong khi các trang vẫn tự dựng bảng màu riêng. Nhãn và tông của
 * trạng thái đơn nay gom về `utils/orderStatus.ts` để chỉ có một nơi phải sửa.
 */
