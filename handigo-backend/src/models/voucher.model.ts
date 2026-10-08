import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IVoucher extends Document, IBaseDocument {
  name: string;
  ownerId?: Types.ObjectId | null;
  reservedOrderId?: Types.ObjectId | null;
  usageLimit?: number | null;
  isActive: boolean;
  code: string;
  description?: string | null;
  discountType: "fixed" | "percentage" | "AMOUNT" | "PERCENT";
  discountValue: number;
  maxDiscountAmount?: Money | null;
  minOrderAmount?: Money | null;
  totalUsageLimit?: number;
  usedCount: number;
  reservedCount: number;
  perUserLimit: number;
  startAt: Date;
  endAt: Date;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "active" | "inactive" | "expired";
}

const VoucherSchema = new Schema<IVoucher>(
  {
    name: { type: String, trim: true, default: function () { return this.code; } },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reservedOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    usageLimit: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: null },
    discountType: { type: String, enum: ["fixed", "percentage", "AMOUNT", "PERCENT"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderAmount: { type: Number, default: null, min: 0 },
    totalUsageLimit: { type: Number, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    reservedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "EXPIRED", "active", "inactive", "expired"], default: "ACTIVE" },
    ...baseFields,
  },
  { timestamps: true },
);

VoucherSchema.index({ status: 1, startAt: 1, endAt: 1 });

export const Voucher = model<IVoucher>("Voucher", VoucherSchema, "vouchers");
