import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IVoucherUsage extends Document, IBaseDocument {
  voucherId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  discountAmount: Money;
  status: "used" | "restored" | "cancelled_not_restored";
  usedAt: Date;
  restoredAt?: Date | null;
}

const VoucherUsageSchema = new Schema<IVoucherUsage>(
  {
    voucherId: { type: Schema.Types.ObjectId, ref: "Voucher", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    discountAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["used", "restored", "cancelled_not_restored"],
      default: "used",
    },
    usedAt: { type: Date, default: Date.now },
    restoredAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

VoucherUsageSchema.index({ voucherId: 1, userId: 1 }, { unique: true });

export const VoucherUsage = model<IVoucherUsage>("VoucherUsage", VoucherUsageSchema);
