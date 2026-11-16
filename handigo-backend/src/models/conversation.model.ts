import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IConversation extends Document, IBaseDocument {
  scope: "order" | "legacy";
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerLastSeenAt?: Date | null;
  providerLastSeenAt?: Date | null;
  lastMessage?: {
    messageId: Types.ObjectId;
    senderId: Types.ObjectId;
    messageType: "text" | "image";
    content: string;
    sentAt: Date;
  } | null;
}

const LastMessageSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    messageType: { type: String, enum: ["text", "image"], required: true },
    content: { type: String, required: true },
    sentAt: { type: Date, required: true },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversation>(
  {
    scope: { type: String, enum: ["order", "legacy"], default: "legacy" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    customerLastSeenAt: { type: Date, default: null },
    providerLastSeenAt: { type: Date, default: null },
    lastMessage: { type: LastMessageSchema, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ConversationSchema.index({ customerId: 1, providerId: 1, isDeleted: 1, createdAt: 1, _id: 1 });
ConversationSchema.index({ orderId: 1, customerId: 1, providerId: 1 }, {
  unique: true,
  name: "order_conversation_participants_unique",
  partialFilterExpression: { scope: "order", isDeleted: false },
});

export const Conversation = model<IConversation>("Conversation", ConversationSchema, "conversations");
