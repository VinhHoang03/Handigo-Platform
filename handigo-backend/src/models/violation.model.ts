import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IViolation extends Document, IBaseDocument {
  userId: Types.ObjectId;
  relatedReportId?: Types.ObjectId | null;
  relatedComplaintId?: Types.ObjectId | null;
  orderId?: Types.ObjectId | null;
  violationType: string;
  severity: "low" | "medium" | "high";
  penaltyType: "warning" | "account_locked" | "provider_suspended";
  status: "active" | "resolved";
  handledBy: Types.ObjectId;
  note?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
}

const ViolationSchema = new Schema<IViolation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    relatedReportId: { type: Schema.Types.ObjectId, ref: "Report", default: null },
    relatedComplaintId: { type: Schema.Types.ObjectId, ref: "Complaint", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    violationType: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
    penaltyType: {
      type: String,
      enum: ["warning", "account_locked", "provider_suspended"],
      required: true,
    },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: null },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ViolationSchema.index({ userId: 1, status: 1 });

export const Violation = model<IViolation>("Violation", ViolationSchema);
