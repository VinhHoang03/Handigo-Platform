import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import type { EvidenceAnalysis, NoShowEvidenceKind } from "../ai/customer-no-show/evidence-agent";

export interface ICustomerNoShowEvidence extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  providerUserId: Types.ObjectId;
  kind: NoShowEvidenceKind;
  url: string;
  sha256: string;
  analysis: EvidenceAnalysis | null;
  analysisStatus: "analyzed" | "unavailable";
  analysisFailure?: { reason: string; httpStatus: number | null } | null;
  uploadedAt?: Date | null;
}

const schema = new Schema<ICustomerNoShowEvidence>({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  providerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  kind: { type: String, enum: ["arrival", "contact"], required: true },
  url: { type: String, required: true },
  sha256: { type: String, required: true },
  uploadedAt: { type: Date, default: null },
  analysis: { type: Schema.Types.Mixed, default: null },
  analysisStatus: { type: String, enum: ["analyzed", "unavailable"], required: true },
  analysisFailure: { type: new Schema({
    reason: { type: String, required: true },
    httpStatus: { type: Number, default: null, min: 400, max: 599 },
  }, { _id: false }), default: null },
  ...baseFields,
}, { timestamps: true });
schema.index({ orderId: 1, providerUserId: 1 });
schema.index({ sha256: 1, orderId: 1 });
export const CustomerNoShowEvidence = model<ICustomerNoShowEvidence>("CustomerNoShowEvidence", schema, "customernoshowevidence");
