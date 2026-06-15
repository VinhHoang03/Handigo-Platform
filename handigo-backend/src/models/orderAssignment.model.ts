import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IOrderAssignment extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: "pending" | "accepted" | "rejected" | "timeout" | "cancelled";
  assignedAt: Date;
  responseDeadline: Date;
  rejectReason?: string | null;
  respondedAt?: Date | null;
}

const OrderAssignmentSchema = new Schema<IOrderAssignment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "timeout", "cancelled"],
      default: "pending",
    },
    assignedAt: { type: Date, default: Date.now },
    responseDeadline: { type: Date, required: true },
    rejectReason: { type: String, default: null },
    respondedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

OrderAssignmentSchema.index({ orderId: 1 });
OrderAssignmentSchema.index({ providerId: 1, status: 1 });
OrderAssignmentSchema.index(
   { orderId: 1, providerId: 1 },
   { unique: true }
);

export const OrderAssignment = model<IOrderAssignment>(
  "OrderAssignment",
  OrderAssignmentSchema,
  "orderassignments",
);
