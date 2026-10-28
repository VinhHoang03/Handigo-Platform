import type { AdminCaseTab } from "./case-detail.types";
import type { PenaltyType, ViolationSeverity, ViolationSourceType } from "@/features/case-management/types/caseManagement.types";

export const VIOLATION_SEVERITY_LABELS: Record<ViolationSeverity, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Nghiêm trọng",
};

export const VIOLATION_SOURCE_LABELS: Record<ViolationSourceType, string> = {
  REPORT: "Báo cáo",
  COMPLAINT: "Khiếu nại",
  SUPPORT_TICKET: "Yêu cầu hỗ trợ",
};

export const PENALTY_LABELS: Record<PenaltyType, string> = {
  WARNING: "Cảnh cáo",
  TEMPORARY_SUSPEND: "Tạm khóa tài khoản",
  PERMANENT_BAN: "Khóa tài khoản vĩnh viễn",
  RESTRICT_FEATURE: "Hạn chế tính năng",
  RESTRICT_ORDER_RECEIVING: "Hạn chế nhận đơn",
  RESTRICT_CHAT: "Hạn chế trò chuyện",
  RESTRICT_VOUCHER: "Hạn chế mã giảm giá",
};

/** Nhãn tiếng Việt dùng chung cho cả bảng danh sách và modal chi tiết. */
export const CASE_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  evidence_requested: "Chờ bổ sung bằng chứng",
  under_review: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  confirmed: "Đã xác nhận",
  active: "Đang áp dụng",
};

export const CASE_STATUS_OPTIONS: Record<AdminCaseTab, string[]> = {
  complaints: ["pending", "evidence_requested", "under_review", "resolved", "rejected", "cancelled"],
  reports: ["pending", "under_review", "confirmed", "rejected", "resolved"],
  violations: ["active", "resolved"],
};
