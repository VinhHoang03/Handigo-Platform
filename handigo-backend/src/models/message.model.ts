import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IMessage extends Document, IBaseDocument {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: "customer" | "provider" | "system";
  messageType: "text" | "image" | "system";
  content?: string | null;
  imageUrl?: string | null;
  status: "sent" | "seen";
  seenAt?: Date | null;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["customer", "provider", "system"], required: true },
    messageType: { type: String, enum: ["text", "image", "system"], required: true },
    content: { type: String, default: null },
    imageUrl: { type: String, default: null },
    status: { type: String, enum: ["sent", "seen"], default: "sent" },
    seenAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = model<IMessage>("Message", MessageSchema, "messages");
