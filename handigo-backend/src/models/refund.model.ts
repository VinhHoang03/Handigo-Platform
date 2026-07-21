import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type RefundStatus =
  | "requested"
  | "requesting"
  | "pending"
  | "succeeded"
  | "failed"
  | "manual_review";

export type RefundChannel = "payos_payout" | "handigo_wallet";
export type RefundDestination = "source_account" | "handigo_wallet";

export interface IRefund extends Document, IBaseDocument {
  paymentId: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: Money;
  reason: string;
  currency: "VND";
  sourceMethod: "payos";
  channel?: RefundChannel | null;
  destination?: RefundDestination | null;
  status: RefundStatus;
  referenceId: string;
  payoutId?: string | null;
  approvalState?: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date | null;
  leaseOwner?: string | null;
  leaseExpiresAt?: Date | null;
  lastAttemptAt?: Date | null;
  lastError?: string | null;
  completedAt?: Date | null;
  manualReviewAt?: Date | null;
  adminAlertedAt?: Date | null;
  providerResponse?: Record<string, unknown> | null;
}

const RefundSchema = new Schema<IRefund>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    currency: { type: String, enum: ["VND"], default: "VND" },
    sourceMethod: { type: String, enum: ["payos"], default: "payos" },
    channel: {
      type: String,
      enum: ["payos_payout", "handigo_wallet"],
      default: null,
    },
    destination: {
      type: String,
      enum: ["source_account", "handigo_wallet"],
      default: null,
    },
    status: {
      type: String,
      enum: [
        "requested",
        "requesting",
        "pending",
        "succeeded",
        "failed",
        "manual_review",
      ],
      default: "requested",
    },
    referenceId: { type: String, required: true },
    payoutId: { type: String, default: null },
    approvalState: { type: String, default: null },
    attemptCount: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    nextRetryAt: { type: Date, default: Date.now },
    leaseOwner: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    completedAt: { type: Date, default: null },
    manualReviewAt: { type: Date, default: null },
    adminAlertedAt: { type: Date, default: null },
    providerResponse: { type: Schema.Types.Mixed, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

RefundSchema.index({ paymentId: 1 }, { unique: true });
RefundSchema.index({ referenceId: 1 }, { unique: true });
RefundSchema.index({ orderId: 1, status: 1 });
RefundSchema.index({ status: 1, nextRetryAt: 1, leaseExpiresAt: 1, updatedAt: 1 });

export const Refund = model<IRefund>("Refund", RefundSchema, "refunds");
