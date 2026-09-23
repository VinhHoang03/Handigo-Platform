import type { ReportType } from "../types/caseManagement.types";

export const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: "harassment", label: "Quấy rối" },
  { value: "insulting_language", label: "Ngôn từ xúc phạm" },
  { value: "fraud", label: "Gian lận" },
  { value: "impersonation", label: "Mạo danh" },
  { value: "spam_booking", label: "Đặt đơn rác" },
  { value: "payment_fraud", label: "Gian lận thanh toán" },
  { value: "user_behavior", label: "Hành vi người dùng" },
  { value: "other", label: "Khác" },
];
