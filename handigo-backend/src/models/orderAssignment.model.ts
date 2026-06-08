import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IOrderAssignment extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: "pending" | "accepted" | "rejected" | "skipped" | "cancelled";
  assignedAt: Date;
  responseDeadline: Date;
  respondedAt?: Date | null;
  reason?: string | null;
}

const OrderAssignmentSchema = new Schema<IOrderAssignment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "skipped", "cancelled"],
      default: "pending",
    },
    assignedAt: { type: Date, default: Date.now },
    responseDeadline: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
    reason: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

OrderAssignmentSchema.index({ orderId: 1 });
OrderAssignmentSchema.index({ providerId: 1, status: 1 });

export const OrderAssignment = model<IOrderAssignment>(
  "OrderAssignment",
  OrderAssignmentSchema,
);
