import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export const COMPLAINT_STATUSES = [
  "pending",
  "evidence_requested",
  "under_review",
  "resolved",
  "rejected",
  "cancelled",
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface IComplaint extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  complainantId: Types.ObjectId;
  complainantRole: "CUSTOMER" | "PROVIDER";
  targetUserId: Types.ObjectId;
  title: string;
  description: string;
  evidenceImages: string[];
  status: ComplaintStatus;
  requestedEvidenceNote?: string | null;
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  resolutionNote?: string | null;
  createdViolationId?: Types.ObjectId | null;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    complainantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    complainantRole: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER"],
      required: true,
      default: "CUSTOMER",
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidenceImages: { type: [String], default: [] },
    status: { type: String, enum: COMPLAINT_STATUSES, default: "pending" },
    requestedEvidenceNote: { type: String, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    createdViolationId: { type: Schema.Types.ObjectId, ref: "Violation", default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ComplaintSchema.index({ orderId: 1 });
ComplaintSchema.index({ orderId: 1, complainantId: 1, isDeleted: 1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });

export const Complaint = model<IComplaint>("Complaint", ComplaintSchema, "complaints");
