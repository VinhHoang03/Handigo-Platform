import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type PaymentMethod = "payos" | "vnpay" | "cash" | "wallet" | "bank";
export type PaymentType = "full" | "remaining" | "inspection_deposit";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface IPayment extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: Money;
  method: PaymentMethod;
  paymentType: PaymentType;
  status: PaymentStatus;
  transactionCode?: string | null;
  gatewayOrderCode?: string | null;
  gatewayPaymentLinkId?: string | null;
  gatewayTransactionId?: string | null;
  gatewayResponse?: Record<string, unknown> | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
  refundedAt?: Date | null;
  failureReason?: string | null;
  refundReason?: string | null;
  compensatedToProviderId?: Types.ObjectId | null;
  compensatedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["payos", "vnpay", "cash", "wallet", "bank"], required: true },
    paymentType: {
      type: String,
      enum: ["full", "remaining", "inspection_deposit"],
      required: true,
    },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    transactionCode: { type: String, default: null },
    gatewayOrderCode: { type: String, default: null },
    gatewayPaymentLinkId: { type: String, default: null },
    gatewayTransactionId: { type: String, default: null },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    refundReason: { type: String, default: null },
    compensatedToProviderId: { type: Schema.Types.ObjectId, ref: "Provider", default: null },
    compensatedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ gatewayOrderCode: 1 });
PaymentSchema.index({ gatewayPaymentLinkId: 1 });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ orderId: 1, paymentType: 1, method: 1, status: 1 });
PaymentSchema.index(
  { orderId: 1, paymentType: 1 },
  {
    name: "order_payment_type_active_unique",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "paid"] },
      isDeleted: false,
    },
  },
);
PaymentSchema.index(
  { method: 1, gatewayOrderCode: 1 },
  {
    name: "payos_gateway_order_code_unique",
    unique: true,
    partialFilterExpression: {
      method: "payos",
      gatewayOrderCode: { $type: "string" },
      isDeleted: false,
    },
  },
);
PaymentSchema.index(
  { method: 1, gatewayPaymentLinkId: 1 },
  {
    name: "payos_payment_link_unique",
    unique: true,
    partialFilterExpression: {
      method: "payos",
      gatewayPaymentLinkId: { $type: "string" },
      isDeleted: false,
    },
  },
);
PaymentSchema.index(
  { method: 1, gatewayTransactionId: 1 },
  {
    name: "payos_transaction_reference_unique",
    unique: true,
    partialFilterExpression: {
      method: "payos",
      gatewayTransactionId: { $type: "string" },
      isDeleted: false,
    },
  },
);

export const Payment = model<IPayment>("Payment", PaymentSchema, "payments");
