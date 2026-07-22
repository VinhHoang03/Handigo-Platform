/**
 * Nhãn trạng thái dùng chung.
 *
 * Trước đây bảng màu lấy thẳng từ palette mặc định của Tailwind
 * (emerald/red/cyan/slate/amber), nằm ngoài hệ design token nên không nhất quán
 * với phần còn lại của app. Nay ánh xạ sang token ngữ nghĩa khai trong index.css.
 */

type Tone = 'success' | 'error' | 'info' | 'neutral' | 'warning';

const toneClasses: Record<Tone, string> = {
  success: 'bg-success-container text-on-success-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  warning: 'bg-warning-container text-on-warning-container',
};

/** Trạng thái không nằm trong bảng này rơi về `warning` — nghĩa "đang chờ xử lý". */
const statusTones: Record<string, Tone> = {
  approved: 'success',
  active: 'success',
  visible: 'success',
  rejected: 'error',
  locked: 'error',
  hidden: 'error',
  expired: 'error',
  resubmitted: 'info',
  draft: 'neutral',
};

const labels: Record<string, string> = {
  approved: 'Đã duyệt',
  pending: 'Chờ duyệt',
  rejected: 'Từ chối',
  resubmitted: 'Đã gửi lại',
  draft: 'Bản nháp',
  active: 'Hoạt động',
  inactive: 'Tạm dừng',
  expired: 'Hết hạn',
  locked: 'Bị khóa',
  visible: 'Đang hiển thị',
  hidden: 'Đã ẩn',
};

export function StatusBadge({ value }: { value: string }) {
  const tone = toneClasses[statusTones[value] ?? 'warning'];

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {labels[value] || value}
    </span>
  );
}
