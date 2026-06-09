import { Document, Schema, model } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IPromotion extends Document, IBaseDocument {
  name: string;
  description?: string | null;
  discountType: "fixed" | "percentage";
  discountValue: number;
  maxDiscountAmount?: Money | null;
  minOrderAmount?: Money | null;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    discountType: { type: String, enum: ["fixed", "percentage"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderAmount: { type: Number, default: null, min: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

PromotionSchema.index({ isActive: 1, startAt: 1, endAt: 1 });

export const Promotion = model<IPromotion>("Promotion", PromotionSchema, "promotions");
