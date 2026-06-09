import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IComplaint extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  complainantId: Types.ObjectId;
  complainantRole: "customer" | "provider";
  targetUserId: Types.ObjectId;
  title: string;
  description: string;
  evidenceImages: string[];
  status: "pending" | "resolved";
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    complainantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    complainantRole: { type: String, enum: ["customer", "provider"], required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidenceImages: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ComplaintSchema.index({ orderId: 1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });

export const Complaint = model<IComplaint>("Complaint", ComplaintSchema);
