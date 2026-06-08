import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IReport extends Document, IBaseDocument {
  reporterId: Types.ObjectId;
  targetType: "user" | "provider" | "order" | "system" | "app";
  targetUserId?: Types.ObjectId | null;
  orderId?: Types.ObjectId | null;
  reportType: "system_bug" | "ui_issue" | "user_behavior" | "payment_issue" | "other";
  title: string;
  description: string;
  evidenceImages: string[];
  status: "pending" | "resolved";
  handledBy?: Types.ObjectId | null;
  handledAt?: Date | null;
  resolutionNote?: string | null;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: {
      type: String,
      enum: ["user", "provider", "order", "system", "app"],
      required: true,
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    reportType: {
      type: String,
      enum: ["system_bug", "ui_issue", "user_behavior", "payment_issue", "other"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidenceImages: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = model<IReport>("Report", ReportSchema);
