import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type RepairQuotationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface IRepairQuotation extends Document, IBaseDocument {
  quotationCode: string;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: RepairQuotationStatus;
  inspectionNote?: string | null;
  recommendation?: string | null;
  attachments: string[];
  subtotalAmount: Money;
  discountAmount: Money;
  finalAmount: Money;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  expiredAt?: Date | null;
  cancelledAt?: Date | null;
  customerConfirmed: boolean;
  providerConfirmed: boolean;
}

const RepairQuotationSchema = new Schema<IRepairQuotation>(
  {
    quotationCode: { type: String, required: true, unique: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired", "cancelled"],
      default: "pending",
    },
    inspectionNote: { type: String, default: null, trim: true },
    recommendation: { type: String, default: null, trim: true },
    attachments: { type: [String], default: [] },
    subtotalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, trim: true },
    expiredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    customerConfirmed: { type: Boolean, default: false },
    providerConfirmed: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

RepairQuotationSchema.index({ orderId: 1 });
RepairQuotationSchema.index({ customerId: 1, createdAt: -1 });
RepairQuotationSchema.index({ providerId: 1, createdAt: -1 });
RepairQuotationSchema.index({ status: 1 });

export const RepairQuotation = model<IRepairQuotation>(
  "RepairQuotation",
  RepairQuotationSchema,
  "repairquotations",
);
