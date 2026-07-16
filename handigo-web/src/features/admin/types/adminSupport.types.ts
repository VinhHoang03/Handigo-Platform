import type { Pagination } from "./admin.types";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_user"
  | "resolved"
  | "closed"
  | "cancelled";

export type SupportTicketCategory =
  | "ACCOUNT"
  | "PAYMENT"
  | "ORDER"
  | "TECHNICAL"
  | "SECURITY"
  | "APPEAL"
  | "OTHER";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportTicketUser {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string | null;
  role?: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

export interface SupportTicketOrder {
  _id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
}

export interface SupportTicketAttachment {
  fileType: "image" | "video" | "file";
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  uploadedAt: string;
}

export interface SupportTicketResponse {
  responderId: SupportTicketUser;
  responderRole: "USER" | "ADMIN";
  message: string;
  attachments: SupportTicketAttachment[];
  respondedAt: string;
}

export interface AdminSupportTicket {
  _id: string;
  requesterId: SupportTicketUser;
  orderId?: SupportTicketOrder | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  assignedAdminId?: SupportTicketUser | null;
  responses: SupportTicketResponse[];
  attachments: SupportTicketAttachment[];
  resolvedBy?: SupportTicketUser | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  createdViolationId?: { _id: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

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
