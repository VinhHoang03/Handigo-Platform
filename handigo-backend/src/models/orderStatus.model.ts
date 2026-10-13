import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import type { OrderStatusValue } from "./order.model";

export interface IOrderStatus extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  status: OrderStatusValue;
  previousStatus?: OrderStatusValue | null;
  statusVersion?: number;
  eventType?: "status_changed";
  changedBy?: Types.ObjectId | null;
  changedByRole: "customer" | "provider" | "admin" | "system";
  note?: string | null;
}

const OrderStatusSchema = new Schema<IOrderStatus>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    previousStatus: { type: String, default: null },
    statusVersion: { type: Number, min: 1 },
    eventType: { type: String, enum: ["status_changed"], default: "status_changed" },
    status: {
      type: String,
      enum: ["created", "paid", "assigned", "accepted", "in_progress", "completed", "cancelled"],
      required: true,
    },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedByRole: {
      type: String,
      enum: ["customer", "provider", "admin", "system"],
      required: true,
    },
    note: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

OrderStatusSchema.index({ orderId: 1 });
OrderStatusSchema.index({ orderId: 1, statusVersion: 1 }, { unique: true, partialFilterExpression: { statusVersion: { $type: "number" } } });

export const OrderStatus = model<IOrderStatus>("OrderStatus", OrderStatusSchema, "orderstatuses");
