import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IProviderApplication extends Document, IBaseDocument {
  userId: Types.ObjectId;
  description: string;
  experienceYears: number;
  serviceIds: Types.ObjectId[];
  workingAreas: string[];
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
}

const ProviderApplicationSchema = new Schema<IProviderApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    experienceYears: { type: Number, required: true, min: 0, default: 0 },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    workingAreas: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    rejectionReason: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ProviderApplicationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const ProviderApplication = model<IProviderApplication>(
  "ProviderApplication",
  ProviderApplicationSchema,
  "providerapplications",
);
