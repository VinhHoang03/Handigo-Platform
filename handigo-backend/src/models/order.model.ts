import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type OrderStatusValue =
  | "created"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ISelectedOptionSnapshot {
  optionId: Types.ObjectId;
  name: string;
  optionType: string;
  price: Money;
}

export interface IOrderPricing {
  bookingAmount: Money;
  platformCommissionRate: number;
  platformCommissionAmount: Money;
  providerEarningAmount: Money;
  promotionDiscountAmount: Money;
  voucherDiscountAmount: Money;
  totalPaidAmount: Money;
}

export interface IDiscountSnapshot {
  promotionId?: Types.ObjectId;
  voucherId?: Types.ObjectId;
  name?: string;
  code?: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  discountAmount: Money;
}

export interface IOrderCancellation {
  cancelledBy: Types.ObjectId;
  cancelledByRole: "customer" | "provider" | "admin";
  reason: string;
  cancelledAt: Date;
  refundPolicy?: {
    policyVersion: string;
    refundRate: number;
    paidAmount: Money;
    refundAmount: Money;
    cancellationFee: Money;
    providerCompensation: Money;
    platformRetainedAmount: Money;
    hoursBeforeStart?: number | null;
    policyReason: string;
  } | null;
}

export interface IOrderConfirmation {
  customerConfirmedAt?: Date | null;
  providerConfirmedAt?: Date | null;
}

export interface IOrder extends Document, IBaseDocument {
  orderCode: string;
  customerId: Types.ObjectId;
  providerId?: Types.ObjectId | null;
  preferredProviderId?: Types.ObjectId | null;
  serviceId: Types.ObjectId;
  servicePackageId?: Types.ObjectId | null;
  selectedOptionIds: Types.ObjectId[];
  selectedOptionsSnapshot: ISelectedOptionSnapshot[];
  addressId: Types.ObjectId;
  orderType: "normal" | "urgent" | "scheduled" | "recurring";
  scheduledAt?: Date | null;
  bookingStatus:
    | "not_required"
    | "awaiting_provider"
    | "awaiting_payment"
    | "reserved"
    | "confirmed"
    | "rejected"
    | "expired";
  paymentDueAt?: Date | null;
  recurringGroupId?: Types.ObjectId | null;
  recurrenceUnit?: "weekly" | "monthly" | null;
  occurrenceNumber?: number | null;
  totalOccurrences?: number | null;
  status: OrderStatusValue;
  paymentMethod: "wallet" | "bank" | "cash";
  paymentStatus: "unpaid" | "partially_paid" | "paid" | "refunded";
  inspectionRequired: boolean;
  depositAmount: Money;
  depositPaidAt?: Date | null;
  readyForMatching: boolean;
  matchingStartedAt?: Date | null;
  platformFeeChargedAt?: Date | null;
  hasAdditionalQuotation: boolean;
  currentQuotationId?: Types.ObjectId | null;
  problemDescription?: string | null;
  customerAttachments?: string[];
  completionEvidenceImages?: string[];
  completionNote?: string | null;
  pricing: IOrderPricing;
  promotionSnapshot?: IDiscountSnapshot | null;
  voucherSnapshot?: IDiscountSnapshot | null;
  cancellation?: IOrderCancellation | null;
  confirmation: IOrderConfirmation;
}

const SelectedOptionSnapshotSchema = new Schema<ISelectedOptionSnapshot>(
  {
    optionId: {
      type: Schema.Types.ObjectId,
      ref: "ServiceOption",
      required: true,
    },
    name: { type: String, required: true },
    optionType: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const OrderPricingSchema = new Schema<IOrderPricing>(
  {
    bookingAmount: { type: Number, required: true, min: 0 },
    platformCommissionRate: { type: Number, required: true, min: 0 },
    platformCommissionAmount: { type: Number, required: true, min: 0 },
    providerEarningAmount: { type: Number, required: true, min: 0 },
    promotionDiscountAmount: { type: Number, default: 0, min: 0 },
    voucherDiscountAmount: { type: Number, default: 0, min: 0 },
    totalPaidAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const DiscountSnapshotSchema = new Schema<IDiscountSnapshot>(
  {
    promotionId: { type: Schema.Types.ObjectId, ref: "Promotion" },
    voucherId: { type: Schema.Types.ObjectId, ref: "Voucher" },
    name: String,
    code: String,
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, required: true, unique: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", default: null },
    preferredProviderId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    servicePackageId: {
      type: Schema.Types.ObjectId,
      ref: "ServicePackage",
      default: null,
    },
    selectedOptionIds: [{ type: Schema.Types.ObjectId, ref: "ServiceOption" }],
    selectedOptionsSnapshot: {
      type: [SelectedOptionSnapshotSchema],
      default: [],
    },
    addressId: { type: Schema.Types.ObjectId, ref: "Address", required: true },
    orderType: {
      type: String,
      enum: ["normal", "urgent", "scheduled", "recurring"],
      default: "normal",
    },
    scheduledAt: { type: Date, default: null },
    bookingStatus: {
      type: String,
      enum: [
        "not_required",
        "awaiting_provider",
        "awaiting_payment",
        "reserved",
        "confirmed",
        "rejected",
        "expired",
      ],
      default: "not_required",
    },
    paymentDueAt: { type: Date, default: null },
    recurringGroupId: { type: Schema.Types.ObjectId, default: null },
    recurrenceUnit: {
      type: String,
      enum: ["weekly", "monthly", null],
      default: null,
    },
    occurrenceNumber: { type: Number, min: 1, default: null },
    totalOccurrences: { type: Number, min: 1, max: 12, default: null },
    status: {
      type: String,
      enum: ["created", "accepted", "in_progress", "completed", "cancelled"],
      default: "created",
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "bank", "cash"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "refunded"],
      default: "unpaid",
    },
    inspectionRequired: { type: Boolean, default: false },
    depositAmount: { type: Number, default: 0, min: 0 },
    depositPaidAt: { type: Date, default: null },
    readyForMatching: { type: Boolean, default: false },
    matchingStartedAt: { type: Date, default: null },
    platformFeeChargedAt: { type: Date, default: null },
    hasAdditionalQuotation: { type: Boolean, default: false },
    currentQuotationId: {
      type: Schema.Types.ObjectId,
      ref: "RepairQuotation",
      default: null,
    },
    problemDescription: { type: String, default: null, trim: true },
    customerAttachments: { type: [String], default: [] },
    completionEvidenceImages: { type: [String], default: [] },
    completionNote: { type: String, default: null, trim: true },
    pricing: { type: OrderPricingSchema, required: true },
    promotionSnapshot: { type: DiscountSnapshotSchema, default: null },
    voucherSnapshot: { type: DiscountSnapshotSchema, default: null },
    cancellation: {
      type: new Schema<IOrderCancellation>(
        {
          cancelledBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          cancelledByRole: {
            type: String,
            enum: ["customer", "provider", "admin"],
            required: true,
          },
          reason: { type: String, required: true },
          cancelledAt: { type: Date, required: true },
          refundPolicy: {
            type: new Schema(
              {
                policyVersion: { type: String, required: true },
                refundRate: { type: Number, required: true, min: 0, max: 100 },
                paidAmount: { type: Number, required: true, min: 0 },
                refundAmount: { type: Number, required: true, min: 0 },
                cancellationFee: { type: Number, required: true, min: 0 },
                providerCompensation: { type: Number, required: true, min: 0 },
                platformRetainedAmount: { type: Number, required: true, min: 0 },
                hoursBeforeStart: { type: Number, default: null },
                policyReason: { type: String, required: true },
              },
              { _id: false },
            ),
            default: null,
          },
        },
        { _id: false },
      ),
      default: null,
    },
    confirmation: {
      customerConfirmedAt: { type: Date, default: null },
      providerConfirmedAt: { type: Date, default: null },
    },
    ...baseFields,
  },
  { timestamps: true },
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ providerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({
  readyForMatching: 1,
  status: 1,
  matchingStartedAt: 1,
  scheduledAt: 1,
});
OrderSchema.index({ providerId: 1, scheduledAt: 1, status: 1 });
OrderSchema.index({ bookingStatus: 1, paymentDueAt: 1 });
OrderSchema.index({ recurringGroupId: 1, occurrenceNumber: 1 });

export const Order = model<IOrder>("Order", OrderSchema, "orders");
