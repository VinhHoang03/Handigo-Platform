import type { AdminCaseTab } from "./case-detail.types";

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
