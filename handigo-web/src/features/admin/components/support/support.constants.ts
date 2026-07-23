import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportSummary,
} from "../../types/adminSupport.types";

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ người dùng",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

export const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  ACCOUNT: "Tài khoản",
  PAYMENT: "Thanh toán",
  ORDER: "Đơn dịch vụ",
  TECHNICAL: "Kỹ thuật",
  SECURITY: "Bảo mật",
  APPEAL: "Khiếu nại",
  OTHER: "Khác",
};

export const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "waiting_user", "resolved"],
  in_progress: ["waiting_user", "resolved"],
  waiting_user: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};

export const EMPTY_SUMMARY: SupportSummary = {
  total: 0,
  active: 0,
  urgentActive: 0,
  unassignedActive: 0,
  waitingUser: 0,
  resolvedToday: 0,
  oldestActiveAt: null,
  averageResolutionMs: 0,
};

export const formatDuration = (milliseconds: number) => {
  if (!milliseconds || milliseconds < 0) return "Chưa có dữ liệu";
  const hours = Math.round(milliseconds / 3_600_000);
  if (hours < 24) return hours + " giờ";
  return (hours / 24).toFixed(1) + " ngày";
};

export const ticketAge = (createdAt: string) => formatDuration(Date.now() - new Date(createdAt).getTime());
