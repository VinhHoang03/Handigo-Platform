import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IConversation extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerLastSeenAt?: Date | null;
  providerLastSeenAt?: Date | null;
}


const ConversationSchema = new Schema<IConversation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    customerLastSeenAt: { type: Date, default: null },
    providerLastSeenAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

export const Conversation = model<IConversation>("Conversation", ConversationSchema, "conversations");
