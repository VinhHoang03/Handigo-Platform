import { z } from "zod";

const appPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\/[a-zA-Z0-9\-_/]*$/, "Trang hiện tại không hợp lệ");

export const sendChatbotMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nội dung tin nhắn")
    .max(1000, "Tin nhắn không được vượt quá 1000 ký tự"),
  currentPath: appPathSchema,
});

export const chatbotHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type SendChatbotMessageInput = z.infer<
  typeof sendChatbotMessageSchema
>;
