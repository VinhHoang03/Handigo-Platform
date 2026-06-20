import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IServiceSuggestion extends Document, IBaseDocument {
  providerId: Types.ObjectId;
  suggestionType: "service" | "category";
  suggestedServiceName?: string | null;
  suggestedCategoryName?: string | null;
  categoryId?: Types.ObjectId | null;
  description?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  adminNote?: string | null;
  createdServiceId?: Types.ObjectId | null;
  createdCategoryId?: Types.ObjectId | null;
}

const ServiceSuggestionSchema = new Schema<IServiceSuggestion>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    suggestionType: {
      type: String,
      enum: ["service", "category"],
      default: "service",
      required: true,
    },
    suggestedServiceName: { type: String, trim: true, default: null },
    suggestedCategoryName: { type: String, trim: true, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, default: null },
    createdServiceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    createdCategoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ServiceSuggestionSchema.pre("validate", function () {
  if (this.suggestionType === "service" && !this.suggestedServiceName?.trim()) {
    this.invalidate("suggestedServiceName", "Tên dịch vụ đề xuất là bắt buộc");
  }

  if (this.suggestionType === "category" && !this.suggestedCategoryName?.trim()) {
    this.invalidate("suggestedCategoryName", "Tên danh mục đề xuất là bắt buộc");
  }
});

ServiceSuggestionSchema.index({ providerId: 1, status: 1 });
ServiceSuggestionSchema.index({ suggestionType: 1, status: 1, createdAt: -1 });

export const ServiceSuggestion = model<IServiceSuggestion>(
  "ServiceSuggestion",
  ServiceSuggestionSchema,
  "servicesuggestions",
);
