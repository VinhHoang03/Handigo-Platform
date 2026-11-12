import { Document, Schema, model, Types } from "mongoose";

interface IViolationEmail extends Document {
  violationId: Types.ObjectId;
  userId: Types.ObjectId;
  to: string;
  subject: string;
  text: string;
  html: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  leaseId: string | null;
  sentAt: Date | null;
}

const ViolationEmailSchema = new Schema<IViolationEmail>({
  violationId: { type: Schema.Types.ObjectId, ref: "Violation", required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  html: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending" },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: { type: String, default: null },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

ViolationEmailSchema.index({ status: 1, nextAttemptAt: 1 });

export const ViolationEmail = model<IViolationEmail>("ViolationEmail", ViolationEmailSchema);
