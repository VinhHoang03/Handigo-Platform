import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import { EVIDENCE_FILE_TYPES, EvidenceFileType } from "./report.model";

export const SUPPORT_TICKET_CATEGORIES = [
  "ACCOUNT",
  "PAYMENT",
  "ORDER",
  "TECHNICAL",
  "SECURITY",
  "APPEAL",
  "OTHER",
] as const;

export const SUPPORT_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const SUPPORT_TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
  "cancelled",
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export interface ISupportTicketAttachment {
  fileType: EvidenceFileType;
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  uploadedAt: Date;
}

export interface ISupportTicketResponse {
  responderId: Types.ObjectId;
  responderRole: "USER" | "ADMIN";
  message: string;
  attachments: ISupportTicketAttachment[];
  respondedAt: Date;
}

export interface ISupportTicket extends Document, IBaseDocument {
  requesterId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  assignedAdminId?: Types.ObjectId | null;
  responses: ISupportTicketResponse[];
  attachments: ISupportTicketAttachment[];
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
  createdViolationId?: Types.ObjectId | null;
}

const SupportTicketAttachmentSchema = new Schema<ISupportTicketAttachment>(
  {
    fileType: { type: String, enum: EVIDENCE_FILE_TYPES, required: true },
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, default: null, trim: true },
    fileName: { type: String, default: null, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SupportTicketResponseSchema = new Schema<ISupportTicketResponse>(
  {
    responderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    responderRole: { type: String, enum: ["USER", "ADMIN"], required: true },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    attachments: { type: [SupportTicketAttachmentSchema], default: [] },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    category: { type: String, enum: SUPPORT_TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: SUPPORT_TICKET_PRIORITIES, default: "MEDIUM" },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: "open" },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responses: { type: [SupportTicketResponseSchema], default: [] },
    attachments: { type: [SupportTicketAttachmentSchema], default: [] },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    createdViolationId: { type: Schema.Types.ObjectId, ref: "Violation", default: null },
    ...baseFields,
  },
  { timestamps: true },
);

SupportTicketSchema.index({ requesterId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedAdminId: 1, status: 1 });

export const SupportTicket = model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema,
  "supporttickets",
);
