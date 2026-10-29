import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export type RescheduleInitiatorRole = "customer" | "provider";
export type RescheduleRequestStatus =
  | "pending"
  | "applied"
  | "rejected"
  | "cancelled"
  | "expired"
  | "conflicted";

export interface IOrderRescheduleRequest extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  initiatorId: Types.ObjectId;
  initiatorRole: RescheduleInitiatorRole;
  initiatorProviderId?: Types.ObjectId | null;
  approvalRole: RescheduleInitiatorRole | null;
  oldScheduledAt: Date;
  proposedScheduledAt: Date;
  reason: string;
  status: RescheduleRequestStatus;
  warningCode?: "PROVIDER_MONTHLY_RESCHEDULE_THRESHOLD" | null;
  warningAcknowledged: boolean;
  monthlyAppliedCountAtRequest?: number | null;
  respondedBy?: Types.ObjectId | null;
  responseReason?: string | null;
  requestedAt: Date;
  expiresAt?: Date | null;
  respondedAt?: Date | null;
  appliedAt?: Date | null;
}

const OrderRescheduleRequestSchema = new Schema<IOrderRescheduleRequest>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    initiatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    initiatorRole: {
      type: String,
      enum: ["customer", "provider"],
      required: true,
    },
    initiatorProviderId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },
    approvalRole: {
      type: String,
      enum: ["customer", "provider", null],
      default: null,
    },
    oldScheduledAt: { type: Date, required: true },
    proposedScheduledAt: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: [
        "pending",
        "applied",
        "rejected",
        "cancelled",
        "expired",
        "conflicted",
      ],
      required: true,
    },
    warningCode: {
      type: String,
      enum: ["PROVIDER_MONTHLY_RESCHEDULE_THRESHOLD", null],
      default: null,
    },
    warningAcknowledged: { type: Boolean, default: false },
    monthlyAppliedCountAtRequest: { type: Number, min: 0, default: null },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responseReason: { type: String, trim: true, maxlength: 500, default: null },
    requestedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

OrderRescheduleRequestSchema.index({ orderId: 1, createdAt: -1 });
OrderRescheduleRequestSchema.index({ orderId: 1, initiatorRole: 1, status: 1 });
OrderRescheduleRequestSchema.index({ initiatorProviderId: 1, status: 1, requestedAt: 1 });
OrderRescheduleRequestSchema.index({ status: 1, expiresAt: 1 });
OrderRescheduleRequestSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: "pending", isDeleted: false } },
);

export const OrderRescheduleRequest = model<IOrderRescheduleRequest>(
  "OrderRescheduleRequest",
  OrderRescheduleRequestSchema,
  "orderreschedulerequests",
);
