import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface ILastMessage {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  messageType: "text" | "image" | "system";
  content: string;
  sentAt: Date;
}

export interface IConversation extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  lastMessage?: ILastMessage | null;
  customerLastSeenAt?: Date | null;
  providerLastSeenAt?: Date | null;
}

const LastMessageSchema = new Schema<ILastMessage>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    messageType: { type: String, enum: ["text", "image", "system"], required: true },
    content: { type: String, required: true },
    sentAt: { type: Date, required: true },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    lastMessage: { type: LastMessageSchema, default: null },
    customerLastSeenAt: { type: Date, default: null },
    providerLastSeenAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

export const Conversation = model<IConversation>("Conversation", ConversationSchema);
