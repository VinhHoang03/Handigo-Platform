import type { SupportTicketStatus, SupportTicketCategory, SupportTicketPriority } from "../types/caseManagement.types";

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ phản hồi",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  ACCOUNT: "Tài khoản",
  PAYMENT: "Thanh toán",
  ORDER: "Đơn dịch vụ",
  TECHNICAL: "Kỹ thuật",
  SECURITY: "Bảo mật",
  APPEAL: "Khiếu nại quyết định",
  OTHER: "Khác",
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const SUPPORT_STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "waiting_user", "resolved"],
  in_progress: ["waiting_user", "resolved"],
  waiting_user: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};


export const ticketDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

/** Ánh xạ sang token ngữ nghĩa thay vì palette mặc định của Tailwind. */
export const TICKET_PRIORITY_CLASSES: Record<string, string> = {
  LOW: 'bg-surface-container-high text-on-surface-variant',
  MEDIUM: 'bg-secondary-container text-on-secondary-container',
  HIGH: 'bg-warning-container text-on-warning-container',
  URGENT: 'bg-error-container text-on-error-container',
};

export const TICKET_PRIORITY_FALLBACK =
  'bg-surface-container-high text-on-surface-variant';
