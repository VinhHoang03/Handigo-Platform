import { SUPPORT_STATUS_LABELS } from "./supportLabels.constants";
import type { CaseTab } from "./caseTabs.constants";

export const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  evidence_requested: "Cần bổ sung bằng chứng",
  under_review: "Đang xem xét",
  rejected: "Đã từ chối",
  ...SUPPORT_STATUS_LABELS,
  confirmed: "Đã xác nhận vi phạm",
};

export const CASE_STATUS_OPTIONS: Record<CaseTab, string[]> = {
  ticket: ["open", "in_progress", "waiting_user", "resolved", "closed", "cancelled"],
  report: ["pending", "evidence_requested", "cancelled", "under_review", "confirmed", "rejected", "resolved"],
};
