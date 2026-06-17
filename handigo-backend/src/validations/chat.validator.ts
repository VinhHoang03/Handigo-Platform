import { z } from "zod";

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
