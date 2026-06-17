import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IServicePackage extends Document, IBaseDocument {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  name: string;
  description?: string | null;
  optionIds: Types.ObjectId[];
  estimatedDurationMinutes?: number | null;
  providerNote?: string | null;
  isActive: boolean;
}

const ServicePackageSchema = new Schema<IServicePackage>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    optionIds: [{ type: Schema.Types.ObjectId, ref: "ServiceOption" }],
    estimatedDurationMinutes: { type: Number, default: null, min: 0 },
    providerNote: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

ServicePackageSchema.index({ providerId: 1, serviceId: 1 });

export const ServicePackage = model<IServicePackage>("ServicePackage", ServicePackageSchema, "servicepackages");
