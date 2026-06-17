import { Document, Schema, model } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IVoucher extends Document, IBaseDocument {
  code: string;
  description?: string | null;
  discountType: "fixed" | "percentage";
  discountValue: number;
  maxDiscountAmount?: Money | null;
  minOrderAmount?: Money | null;
  totalUsageLimit: number;
  usedCount: number;
  perUserLimit: number;
  startAt: Date;
  endAt: Date;
  status: "active" | "inactive" | "expired";
}

const VoucherSchema = new Schema<IVoucher>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: null },
    discountType: { type: String, enum: ["fixed", "percentage"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderAmount: { type: Number, default: null, min: 0 },
    totalUsageLimit: { type: Number, required: true, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive", "expired"], default: "active" },
    ...baseFields,
  },
  { timestamps: true },
);

VoucherSchema.index({ status: 1, startAt: 1, endAt: 1 });

export const Voucher = model<IVoucher>("Voucher", VoucherSchema, "vouchers");
