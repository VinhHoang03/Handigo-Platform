import type { SupportTicketCategory } from "../types/caseManagement.types";

export const CATEGORY_OPTIONS: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: "ACCOUNT", label: "Tài khoản" },
  { value: "PAYMENT", label: "Thanh toán" },
  { value: "ORDER", label: "Đơn dịch vụ" },
  { value: "TECHNICAL", label: "Kỹ thuật" },
  { value: "SECURITY", label: "Bảo mật" },
  { value: "APPEAL", label: "Khiếu nại quyết định" },
  { value: "OTHER", label: "Khác" },
];
