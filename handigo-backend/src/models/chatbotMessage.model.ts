import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IChatbotMessage extends Document, IBaseDocument {
  conversationId: Types.ObjectId;
  sender: "user" | "assistant";
  content: string;
  pagePath?: string | null;
}

const ChatbotMessageSchema = new Schema<IChatbotMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatbotConversation",
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true, trim: true, maxlength: 6000 },
    pagePath: { type: String, default: null, maxlength: 200 },
    ...baseFields,
  },
  { timestamps: true },
);

ChatbotMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatbotMessage = model<IChatbotMessage>(
  "ChatbotMessage",
  ChatbotMessageSchema,
  "chatbot_messages",
);
