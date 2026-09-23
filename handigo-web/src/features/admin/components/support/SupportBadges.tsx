import { toneChipClasses, toneTextClasses, type StatusTone } from "@/utils/statusTone";
import type { SupportTicketPriority, SupportTicketStatus } from "../../types/adminSupport.types";
import { PRIORITY_LABELS, STATUS_LABELS } from "./support.constants";

const STATUS_TONES: Record<SupportTicketStatus, StatusTone> = {
  open: "info",
  in_progress: "warning",
  waiting_user: "brand",
  resolved: "success",
  closed: "neutral",
  cancelled: "error",
};

const PRIORITY_TONES: Record<SupportTicketPriority, StatusTone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "error",
};

export function SupportStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneChipClasses[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SupportPriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  return (
    <span className={`text-xs font-bold ${toneTextClasses[PRIORITY_TONES[priority]]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
