import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IServiceSuggestion extends Document, IBaseDocument {
  providerId: Types.ObjectId;
  suggestedServiceName: string;
  description?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  adminNote?: string | null;
  createdServiceId?: Types.ObjectId | null;
}

const ServiceSuggestionSchema = new Schema<IServiceSuggestion>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    suggestedServiceName: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, default: null },
    createdServiceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ServiceSuggestionSchema.index({ providerId: 1, status: 1 });

export const ServiceSuggestion = model<IServiceSuggestion>(
  "ServiceSuggestion",
  ServiceSuggestionSchema,
  "servicesuggestions",
);
