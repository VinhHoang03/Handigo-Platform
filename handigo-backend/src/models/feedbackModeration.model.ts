import { Schema, model, Types } from "mongoose";

export interface IFeedbackModeration {
  userId: Types.ObjectId;
  resourceId: Types.ObjectId;
  kind: "comment" | "reply";
  contentHash: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  decision?: "allow" | "block" | "review";
  source?: "rules" | "ai" | "unavailable";
  feedbackId?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFeedbackModeration>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  resourceId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ["comment", "reply"], required: true },
  contentHash: { type: String, required: true },
  content: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", required: true },
  reason: { type: String, required: true, maxlength: 500 },
  decision: { type: String, enum: ["allow", "block", "review"] },
  source: { type: String, enum: ["rules", "ai", "unavailable"] },
  feedbackId: { type: Schema.Types.ObjectId, ref: "Feedback" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
}, { timestamps: true });

schema.index({ userId: 1, resourceId: 1, kind: 1, contentHash: 1 }, { unique: true });
schema.index({ status: 1, createdAt: 1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ createdAt: -1, _id: -1 });

export const FeedbackModeration = model<IFeedbackModeration>("FeedbackModeration", schema);
