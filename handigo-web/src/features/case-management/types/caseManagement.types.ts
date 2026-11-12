import type { Pagination } from "@/types/booking";

export type EvidenceFileType = "image" | "video" | "file";

export interface CaseUser {
  _id: string;
  fullName: string;
  email?: string;
  avatar?: string | null;
  role?: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

export interface CaseOrder {
  _id: string;
  orderCode: string;
  status: string;
  paymentStatus?: string;
  customerId?: CaseUser | null;
  providerId?: { _id: string; userId?: CaseUser | null } | null;
}

export interface EvidenceFile {
  fileType: EvidenceFileType;
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  uploadedAt?: string;
  uploadedBy?: CaseUser | null;
  note?: string | null;
}

export interface ComplaintEvidence extends EvidenceFile {
  _id: string;
  uploadedBy: CaseUser;
  note?: string | null;
  createdAt: string;
}

export type ComplaintStatus =
  | "pending"
  | "evidence_requested"
  | "under_review"
  | "resolved"
  | "rejected"
  | "cancelled";

export interface Complaint {
  _id: string;
  orderId: CaseOrder;
  complainantId: CaseUser;
  targetUserId: CaseUser;
  title: string;
  description: string;
  evidenceImages: string[];
  evidence?: ComplaintEvidence[];
  status: ComplaintStatus;
  requestedEvidenceNote?: string | null;
  resolutionNote?: string | null;
  createdViolationId?: { _id: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

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
  | "GUIDANCE"
  | "OTHER";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportTicketResponse {
  responderId: CaseUser | null;
  responderRole: "USER" | "ADMIN";
  message: string;
  attachments: EvidenceFile[];
  respondedAt: string;
}

export interface SupportTicket {
  _id: string;
  requesterId: CaseUser | null;
  assignedAdminId?: CaseUser | null;
  resolvedBy?: CaseUser | null;
  resolvedAt?: string | null;
  orderId?: CaseOrder | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  responses: SupportTicketResponse[];
  attachments: EvidenceFile[];
  resolutionNote?: string | null;
  createdViolationId?: { _id: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type ReportTargetType =
  | "user"
  | "provider"
  | "order"
  | "feedback"
  | "chat_conversation"
  | "system"
  | "app";

export type ReportType =
  | "service_quality"
  | "spam_chat"
  | "harassment"
  | "insulting_language"
  | "fraud"
  | "impersonation"
  | "advertisement"
  | "spam_booking"
  | "voucher_abuse"
  | "payment_fraud"
  | "fake_review"
  | "sabotage"
  | "false_reporting"
  | "system_bug"
  | "ui_issue"
  | "user_behavior"
  | "payment_issue"
  | "other";

export type ReportStatus =
  | "evidence_requested"
  | "cancelled"
  | "pending"
  | "under_review"
  | "confirmed"
  | "rejected"
  | "resolved";

export interface Report {
  noShowDetails?: {
    callComparison?: {
      expectedPhone: string; phoneSource: 'order_recipient' | 'customer_account';
      waitStartedAt: string; checkedAt: string; validCount: number; skipWaitForTesting: boolean;
      events: Array<{
        phoneNumber: string | null; normalizedPhone: string; resolvedAt: string | null;
        phoneMatched: boolean; inWindow: boolean; direction: 'outgoing' | 'incoming' | 'unknown';
        outcome: 'no_answer' | 'answered' | 'unknown'; eligible: boolean; failures: string[];
      }>;
    };
    location: {
      orderAddress: string | null; arrivalAddress: string | null; attribution: string | null;
      arrivedAt: string | null; distanceMeters: number | null; withinRadius: boolean | null; radiusMeters: number;
    };
    evidence: Array<{
      id: string; kind: 'arrival' | 'contact'; url: string; analysisStatus: 'analyzed' | 'unavailable';
      analysisFailure?: { reason: string; httpStatus: number | null } | null;
      resolvedContactAt?: string | null;
      callEvents?: Array<{
        phoneNumber: string | null; dateLabel: string | null; time: string | null;
        occurredAt: string | null; resolvedAt: string | null;
        eligible?: boolean; failures?: string[]; timePrecision?: 'minute' | 'second';
        direction: 'outgoing' | 'incoming' | 'unknown'; outcome: 'no_answer' | 'answered' | 'unknown';
      }>;
      analysis: {
        imageType: 'arrival' | 'chat' | 'call' | 'other'; locationText: string | null;
        chatChannel?: 'handigo' | 'external' | 'unknown';
        phoneNumbers: string[]; contactAt: string | null; providerMessage: string | null;
        contactDateLabel?: string | null; contactTime?: string | null;
        contactOutcome: 'no_response' | 'no_answer' | 'answered' | 'unknown'; uncertainties: string[];
      } | null;
    }>;
  } | null;
  noShowVerification?: {
    decision: 'auto_eligible' | 'manual_review'; reasons: string[]; checkedAt: string; policyVersion: string;
    checks?: {
      location: { passed: boolean; distanceMeters: number | null; radiusMeters: number };
      waiting: { passed: boolean; skippedForTesting: boolean; waitStartedAt: string; requiredMinutes: number };
      calls: { passed: boolean; validCount: number; requiredCount: number };
      chat: { passed: boolean; messageCount: number; customerReplied: boolean };
    } | null;
  } | null;
  reviewedByType?: 'system' | 'admin' | null;
  isCustomerNoShow?: boolean;
  _id: string;
  reporterId: CaseUser;
  targetType: ReportTargetType;
  targetUserId?: CaseUser | null;
  orderId?: CaseOrder | null;
  reportType: ReportType;
  requestedEvidenceNote?: string | null;
  title: string;
  description: string;
  evidenceImages: string[];
  evidenceFiles: EvidenceFile[];
  status: ReportStatus;
  reviewNote?: string | null;
  resolutionNote?: string | null;
  createdViolationId?: { _id: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseList<T> {
  items: T[];
  pagination: Pagination;
}

export interface CaseListQuery {
  page?: number;
  limit?: number;
  status?: string;
  keyword?: string;
}

export interface CreateComplaintPayload {
  orderId: string;
  title: string;
  description: string;
  evidenceImages?: string[];
}

export interface CreateSupportTicketPayload {
  orderId?: string | null;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  subject?: string;
  description: string;
  attachments?: EvidenceFile[];
}

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetUserId?: string;
  targetProviderId?: string;
  orderId?: string;
  targetFeedbackId?: string;
  conversationId?: string;
  reportType: ReportType;
  requestedEvidenceNote?: string | null;
  title: string;
  description: string;
  evidenceImages?: string[];
  evidenceFiles?: EvidenceFile[];
}

export type ViolationSourceType = "REPORT" | "COMPLAINT" | "SUPPORT_TICKET";
export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PenaltyType =
  | "WARNING"
  | "TEMPORARY_SUSPEND"
  | "PERMANENT_BAN"
  | "RESTRICT_FEATURE"
  | "RESTRICT_ORDER_RECEIVING"
  | "RESTRICT_CHAT"
  | "RESTRICT_VOUCHER";

export interface Violation {
  _id: string;
  userId: CaseUser;
  sourceType: ViolationSourceType;
  sourceId: string;
  violationType: string;
  severity: ViolationSeverity;
  penaltyType: PenaltyType;
  penalty?: {
    type: PenaltyType;
    feature?: string | null;
    durationDays?: number | null;
    note?: string | null;
  } | null;
  status: "active" | "resolved";
  reason?: string | null;
  adminDecision?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
}

export interface CreateViolationPayload {
  userId?: string;
  sourceType: ViolationSourceType;
  sourceId: string;
  orderId?: string;
  violationType: string;
  severity: ViolationSeverity;
  reason: string;
  adminDecision: string;
  penalty: {
    type: PenaltyType;
    feature?: string | null;
    durationDays?: number | null;
    note?: string | null;
  };
}
