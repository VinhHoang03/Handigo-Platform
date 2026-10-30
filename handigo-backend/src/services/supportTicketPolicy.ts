import type { SupportTicketCategory, SupportTicketPriority } from "../models/supportTicket.model";

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  ACCOUNT: "Tài khoản", PAYMENT: "Thanh toán", TECHNICAL: "Lỗi ứng dụng",
  APPEAL: "Đề nghị xem xét", GUIDANCE: "Hướng dẫn",
  ORDER: "Đơn dịch vụ", SECURITY: "Bảo mật", OTHER: "Khác",
};

export const SUPPORT_CATEGORY_PRIORITIES: Record<SupportTicketCategory, SupportTicketPriority> = {
  PAYMENT: "URGENT", ACCOUNT: "HIGH", TECHNICAL: "HIGH",
  APPEAL: "MEDIUM", GUIDANCE: "MEDIUM",
  ORDER: "MEDIUM", SECURITY: "HIGH", OTHER: "MEDIUM",
};
