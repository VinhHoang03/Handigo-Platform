import type { Pagination } from "./admin.types";
import type { SupportTicket } from "@/features/case-management/types/caseManagement.types";
export type {
  SupportTicketStatus, SupportTicketCategory, SupportTicketPriority,
  CaseUser as SupportTicketUser, CaseOrder as SupportTicketOrder,
  EvidenceFile as SupportTicketAttachment, SupportTicketResponse,
} from "@/features/case-management/types/caseManagement.types";
import type { SupportTicketStatus, SupportTicketCategory, SupportTicketPriority } from "@/features/case-management/types/caseManagement.types";
export type AdminSupportTicket = SupportTicket;

export interface SupportSummary {
  total: number;
  active: number;
  urgentActive: number;
  unassignedActive: number;
  waitingUser: number;
  resolvedToday: number;
  oldestActiveAt?: string | null;
  averageResolutionMs: number;
}

export interface SupportTicketList {
  items: AdminSupportTicket[];
  pagination: Pagination;
  summary: SupportSummary;
}

export interface SupportTicketQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  priority?: SupportTicketPriority;
  assignedAdminId?: string;
  assignment?: "assigned" | "unassigned";
}
