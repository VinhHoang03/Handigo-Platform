import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IProvider extends Document, IBaseDocument {
  userId: Types.ObjectId;
  description: string;
  experienceYears: number;
  availabilityStatus: "online" | "offline" | "busy";
  verified: boolean;
  serviceCategoryIds: Types.ObjectId[];
  workingAreas: string[];
  averageRating: number;
  totalFeedbacks: number;
  totalCompletedOrders: number;
}

const ProviderSchema = new Schema<IProvider>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    description: { type: String, required: true },
    experienceYears: { type: Number, required: true, min: 0, default: 0 },
    availabilityStatus: { type: String, enum: ["online", "offline", "busy"], default: "offline" },
    verified: { type: Boolean, default: false },
    serviceCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    workingAreas: { type: [String], default: [] },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalFeedbacks: { type: Number, default: 0, min: 0 },
    totalCompletedOrders: { type: Number, default: 0, min: 0 },
    ...baseFields,
  },
  { timestamps: true },
);

ProviderSchema.index({ serviceCategoryIds: 1 });
ProviderSchema.index({ availabilityStatus: 1, verified: 1 });

export const Provider = model<IProvider>("Provider", ProviderSchema, "providers");
