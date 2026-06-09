import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import { OrderStatusValue } from "./order.model";

export interface IOrderStatus extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  status: OrderStatusValue;
  changedBy?: Types.ObjectId | null;
  changedByRole: "customer" | "provider" | "admin" | "system";
  note?: string | null;
}

const OrderStatusSchema = new Schema<IOrderStatus>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
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

export const OrderStatus = model<IOrderStatus>("OrderStatus", OrderStatusSchema, "orderstatuses");
