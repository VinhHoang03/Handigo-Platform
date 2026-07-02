import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export const REPORT_TARGET_TYPES = [
  "user",
  "provider",
  "order",
  "feedback",
  "chat_conversation",
  "system",
  "app",
] as const;

export const REPORT_TYPES = [
  "spam_chat",
  "harassment",
  "insulting_language",
  "fraud",
  "impersonation",
  "advertisement",
  "spam_booking",
  "voucher_abuse",
  "payment_fraud",
  "fake_review",
  "sabotage",
  "false_reporting",
  "system_bug",
  "ui_issue",
  "user_behavior",
  "payment_issue",
  "other",
] as const;

export const REPORT_STATUSES = [
  "pending",
  "under_review",
  "confirmed",
  "rejected",
  "resolved",
] as const;

export const EVIDENCE_FILE_TYPES = ["image", "video", "file"] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type EvidenceFileType = (typeof EVIDENCE_FILE_TYPES)[number];

export interface IReportEvidenceFile {
  fileType: EvidenceFileType;
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  uploadedAt: Date;
}

export interface IReport extends Document, IBaseDocument {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetUserId?: Types.ObjectId | null;
  orderId?: Types.ObjectId | null;
  targetFeedbackId?: Types.ObjectId | null;
  conversationId?: Types.ObjectId | null;
  reportType: ReportType;
  title: string;
  description: string;
  evidenceImages: string[];
  evidenceFiles: IReportEvidenceFile[];
  status: ReportStatus;
  handledBy?: Types.ObjectId | null;
  handledAt?: Date | null;
  reviewNote?: string | null;
  resolutionNote?: string | null;
  createdViolationId?: Types.ObjectId | null;
}

const ReportEvidenceFileSchema = new Schema<IReportEvidenceFile>(
  {
    fileType: {
      type: String,
      enum: EVIDENCE_FILE_TYPES,
      required: true,
    },
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, default: null, trim: true },
    fileName: { type: String, default: null, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    targetFeedbackId: { type: Schema.Types.ObjectId, ref: "Feedback", default: null },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    reportType: {
      type: String,
      enum: REPORT_TYPES,
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidenceImages: { type: [String], default: [] },
    evidenceFiles: { type: [ReportEvidenceFileSchema], default: [] },
    status: { type: String, enum: REPORT_STATUSES, default: "pending" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
    resolutionNote: { type: String, default: null },
    createdViolationId: { type: Schema.Types.ObjectId, ref: "Violation", default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reporterId: 1, createdAt: -1 });
ReportSchema.index({ targetUserId: 1, status: 1 });

export const Report = model<IReport>("Report", ReportSchema, "reports");
