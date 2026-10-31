import { Schema, model, Types } from "mongoose";

export interface IViolationEmail {
  violationId: Types.ObjectId;
  userId: Types.ObjectId;
  to: string;
  subject: string;
  text: string;
  html: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  leaseId?: string | null;
  sentAt?: Date | null;
}

const schema = new Schema<IViolationEmail>({
  violationId: { type: Schema.Types.ObjectId, ref: "Violation", required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  html: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending" },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: { type: String, default: null },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ status: 1, nextAttemptAt: 1 });

export const ViolationEmail = model<IViolationEmail>("ViolationEmail", schema, "violation_emails");
