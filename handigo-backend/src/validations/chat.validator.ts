import { z } from "zod";

export const conversationIdParamSchema = z.object({
  conversationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID cuộc trò chuyện không hợp lệ"),
});

export const sendMessageSchema = z
  .object({
    messageType: z.enum(["text", "image"]).default("text"),
    content: z.string().trim().max(2000).optional(),
    imageUrl: z.string().trim().url().optional(),
  })
  .refine(
    (data) => {
      if (data.messageType === "text") return Boolean(data.content);
      return Boolean(data.imageUrl);
    },
    "Message content or image URL is required",
  );

export const reportConversationSchema = z.object({
  description: z.string().trim().min(10).max(1000),
});

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
