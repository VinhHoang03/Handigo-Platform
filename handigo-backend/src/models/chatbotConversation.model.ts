import { Document, Schema, model, Types } from "mongoose";
import type { UserRole } from "./user.model";
import { baseFields, IBaseDocument } from "./common";

export interface IChatbotConversation extends Document, IBaseDocument {
  userId: Types.ObjectId;
  role: Exclude<UserRole, "ADMIN">;
  lastMessageAt?: Date | null;
}

const ChatbotConversationSchema = new Schema<IChatbotConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER"],
      required: true,
    },
    lastMessageAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

export const ChatbotConversation = model<IChatbotConversation>(
  "ChatbotConversation",
  ChatbotConversationSchema,
  "chatbot_conversations",
);
