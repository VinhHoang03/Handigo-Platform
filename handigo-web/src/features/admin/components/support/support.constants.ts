import type {
  SupportSummary,
} from "../../types/adminSupport.types";

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export {
  SUPPORT_STATUS_LABELS as STATUS_LABELS,
  SUPPORT_CATEGORY_LABELS as CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS as PRIORITY_LABELS,
  SUPPORT_STATUS_TRANSITIONS as STATUS_TRANSITIONS,
} from "@/features/case-management/components/supportLabels.constants";

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

export const ticketAge = (createdAt: string) => {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(elapsed)) return "Chưa có dữ liệu";
  if (elapsed < 86_400_000) return Math.max(0, Math.round(elapsed / 3_600_000)) + " giờ";
  return Math.round(elapsed / 86_400_000) + " ngày";
};
