export const supportCategories = [
  {
    icon: 'manage_accounts',
    title: 'Tài khoản',
    text: 'Bảo mật, thông tin cá nhân và cài đặt ứng dụng.',
  },
  {
    icon: 'payments',
    title: 'Thanh toán',
    text: 'Hóa đơn, hoàn tiền và phương thức thanh toán.',
  },
  {
    icon: 'home_repair_service',
    title: 'Dịch vụ',
    text: 'Chất lượng dịch vụ, lịch hẹn và phản hồi thợ.',
  },
  {
    icon: 'bug_report',
    title: 'Lỗi kỹ thuật',
    text: 'Sự cố ứng dụng hoặc lỗi trong quá trình đặt lịch.',
  },
];

/* `faqs` (3 câu) đã chuyển sang `support-faq.ts` và mở rộng thành 16 câu theo
   đúng 4 nhóm của `supportCategories`, để ô tìm kiếm trên trang Hỗ trợ có nội
   dung thật để lọc. */

export const supportChannels = [
  {
    icon: 'support_agent',
    title: 'Tổng đài hỗ trợ',
    value: '1900 1234',
    text: 'Phục vụ hằng ngày từ 7:00 đến 22:00.',
    href: 'tel:19001234',
  },
  {
    icon: 'mail',
    title: 'Email chăm sóc khách hàng',
    value: 'support@handigo.vn',
    text: 'Phù hợp cho yêu cầu cần mô tả chi tiết hoặc gửi kèm hình ảnh.',
    href: 'mailto:support@handigo.vn',
  },
  {
    icon: 'chat',
    title: 'Hỗ trợ trong ứng dụng',
    value: 'Trò chuyện với Handigo',
    text: 'Theo dõi và phản hồi trực tiếp theo từng yêu cầu đã gửi.',
  },
];

export const ticketDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Mới tiếp nhận',
  in_progress: 'Đang xử lý',
  waiting_user: 'Chờ phản hồi',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
};

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT: 'Tài khoản',
  PAYMENT: 'Thanh toán',
  ORDER: 'Đơn dịch vụ',
  TECHNICAL: 'Kỹ thuật',
  SECURITY: 'Bảo mật',
  APPEAL: 'Khiếu nại quyết định',
  OTHER: 'Khác',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

/** Ánh xạ sang token ngữ nghĩa thay vì palette mặc định của Tailwind. */
export const TICKET_PRIORITY_CLASSES: Record<string, string> = {
  LOW: 'bg-surface-container-high text-on-surface-variant',
  MEDIUM: 'bg-secondary-container text-on-secondary-container',
  HIGH: 'bg-warning-container text-on-warning-container',
  URGENT: 'bg-error-container text-on-error-container',
};

export const TICKET_PRIORITY_FALLBACK =
  'bg-surface-container-high text-on-surface-variant';
