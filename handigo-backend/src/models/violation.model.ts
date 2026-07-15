import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export const VIOLATION_SOURCE_TYPES = ["REPORT", "COMPLAINT", "SUPPORT_TICKET"] as const;
export const VIOLATION_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
  "low",
  "medium",
  "high",
] as const;
export const PENALTY_TYPES = [
  "WARNING",
  "TEMPORARY_SUSPEND",
  "PERMANENT_BAN",
  "RESTRICT_FEATURE",
  "RESTRICT_ORDER_RECEIVING",
  "RESTRICT_CHAT",
  "RESTRICT_VOUCHER",
  "warning",
  "account_locked",
  "provider_suspended",
] as const;
export const VIOLATION_STATUSES = ["active", "resolved"] as const;

export type ViolationSourceType = (typeof VIOLATION_SOURCE_TYPES)[number];
export type ViolationSeverity = (typeof VIOLATION_SEVERITIES)[number];
export type PenaltyType = (typeof PENALTY_TYPES)[number];
export type ViolationStatus = (typeof VIOLATION_STATUSES)[number];

export interface IViolationPenalty {
  type: PenaltyType;
  feature?: string | null;
  durationDays?: number | null;
  note?: string | null;
}

export interface IViolation extends Document, IBaseDocument {
  userId: Types.ObjectId;
  sourceType?: ViolationSourceType | null;
  sourceId?: Types.ObjectId | null;
  relatedReportId?: Types.ObjectId | null;
  relatedComplaintId?: Types.ObjectId | null;
  relatedSupportTicketId?: Types.ObjectId | null;
  orderId?: Types.ObjectId | null;
  violationType: string;
  severity: ViolationSeverity;
  penaltyType: PenaltyType;
  penalty?: IViolationPenalty | null;
  status: ViolationStatus;
  handledBy: Types.ObjectId;
  reason?: string | null;
  adminDecision?: string | null;
  note?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  appliedAt?: Date | null;
}

const ViolationPenaltySchema = new Schema<IViolationPenalty>(
  {
    type: { type: String, enum: PENALTY_TYPES, required: true },
    feature: { type: String, default: null, trim: true },
    durationDays: { type: Number, default: null, min: 1 },
    note: { type: String, default: null },
  },
  { _id: false },
);

const ViolationSchema = new Schema<IViolation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceType: { type: String, enum: VIOLATION_SOURCE_TYPES, default: null },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    relatedReportId: { type: Schema.Types.ObjectId, ref: "Report", default: null },
    relatedComplaintId: { type: Schema.Types.ObjectId, ref: "Complaint", default: null },
    relatedSupportTicketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    violationType: { type: String, required: true },
    severity: { type: String, enum: VIOLATION_SEVERITIES, required: true },
    penaltyType: {
      type: String,
      enum: PENALTY_TYPES,
      required: true,
    },
    penalty: { type: ViolationPenaltySchema, default: null },
    status: { type: String, enum: VIOLATION_STATUSES, default: "active" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: null },
    adminDecision: { type: String, default: null },
    note: { type: String, default: null },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ViolationSchema.index({ userId: 1, status: 1 });
ViolationSchema.index({ sourceType: 1, sourceId: 1 });

export const Violation = model<IViolation>("Violation", ViolationSchema, "violations");
