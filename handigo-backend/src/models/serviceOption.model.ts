import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type ServiceOptionType = "inspection" | "cleaning" | "installation" | "repair" | "other";

export interface IServiceOption extends Document, IBaseDocument {
  serviceId: Types.ObjectId;
  name: string;
  description?: string | null;
  optionType: ServiceOptionType;
  fixedPrice: Money;
  isFixedPrice: boolean;
  isActive: boolean;
}

const ServiceOptionSchema = new Schema<IServiceOption>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    optionType: {
      type: String,
      enum: ["inspection", "cleaning", "installation", "repair", "other"],
      required: true,
    },
    fixedPrice: { type: Number, required: true, min: 0, default: 0 },
    isFixedPrice: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

ServiceOptionSchema.index({ serviceId: 1 });

export const ServiceOption = model<IServiceOption>("ServiceOption", ServiceOptionSchema);
