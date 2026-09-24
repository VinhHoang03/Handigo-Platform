import type { CaseTab } from "./caseTabs.constants";

export const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  evidence_requested: "Cần bổ sung bằng chứng",
  under_review: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  waiting_user: "Chờ phản hồi",
  closed: "Đã đóng",
  confirmed: "Đã xác nhận vi phạm",
};

export const CASE_STATUS_OPTIONS: Record<CaseTab, string[]> = {
  complaint: ["pending", "evidence_requested", "under_review", "resolved", "rejected", "cancelled"],
  ticket: ["open", "in_progress", "waiting_user", "resolved", "closed", "cancelled"],
  report: ["pending", "under_review", "confirmed", "rejected", "resolved"],
};
