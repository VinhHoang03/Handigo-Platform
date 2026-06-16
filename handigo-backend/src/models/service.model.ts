import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IService extends Document, IBaseDocument {
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  serviceType: "fixed_price" | "variable_price";
  fixedPrice?: number | null;
  depositAmount?: number | null;
  image?: string | null;
  isActive: boolean;
}

const ServiceSchema = new Schema<IService>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: null },
    serviceType: {
      type: String,
      enum: ["fixed_price", "variable_price"],
      required: true,
    },
    fixedPrice: { type: Number, min: 0, default: null },
    depositAmount: { type: Number, min: 0, default: null },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

ServiceSchema.index({ categoryId: 1, slug: 1 }, { unique: true });
ServiceSchema.index({ categoryId: 1 });
ServiceSchema.index({ fixedPrice: 1 });

export const Service = model<IService>("Service", ServiceSchema, "services");
