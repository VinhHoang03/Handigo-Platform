import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IPayment extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: Money;
  method: "payos" | "vnpay";
  status: "pending" | "paid" | "failed" | "refunded";
  transactionCode?: string | null;
  gatewayResponse?: Record<string, unknown> | null;
  paidAt?: Date | null;
  refundedAt?: Date | null;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["payos", "vnpay"], required: true },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    transactionCode: { type: String, default: null },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

PaymentSchema.index({ orderId: 1 });

export const Payment = model<IPayment>("Payment", PaymentSchema, "payments");
