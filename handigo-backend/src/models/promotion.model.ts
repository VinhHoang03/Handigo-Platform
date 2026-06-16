import { Document, Schema, model } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IPromotion extends Document, IBaseDocument {
  name: string;
  code?: string | null;
  description?: string | null;
  discountType: "fixed" | "percentage" | "AMOUNT" | "PERCENT";
  discountValue: number;
  maxDiscountAmount?: Money | null;
  minOrderAmount?: Money | null;
  usageLimit?: number | null;
  usedCount: number;
  startAt: Date;
  endAt: Date;
  status?: "ACTIVE" | "INACTIVE" | "EXPIRED" | "active" | "inactive" | "expired";
  isActive: boolean;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    name: { type: String, required: true },
    code: { type: String, default: null, uppercase: true, trim: true },
    description: { type: String, default: null },
    discountType: { type: String, enum: ["fixed", "percentage", "AMOUNT", "PERCENT"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderAmount: { type: Number, default: null, min: 0 },
    usageLimit: { type: Number, default: null, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "EXPIRED", "active", "inactive", "expired"], default: "ACTIVE" },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

PromotionSchema.index({ isActive: 1, startAt: 1, endAt: 1 });
PromotionSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string" } } },
);
PromotionSchema.index({ status: 1, startAt: 1, endAt: 1 });

export const Promotion = model<IPromotion>("Promotion", PromotionSchema, "promotions");
