import { z } from "zod";
import { AppError } from "../../utils/appError";
import type { AgentSession } from "./agent-state";

export const bookingAttachmentsSchema = z.array(z.string().url("Liên kết ảnh không hợp lệ.").max(1000, "Liên kết ảnh quá dài.").startsWith("https://", "Ảnh phải dùng liên kết HTTPS."))
  .max(4, "Chỉ được đính kèm tối đa 4 ảnh.")
  .refine((urls) => new Set(urls).size === urls.length, "Ảnh đính kèm không được trùng lặp.");

export function requireBookingAttachments(session: AgentSession | undefined, urls?: string[]) {
  if (urls?.some((url) => !session?.uploadedAttachments?.includes(url))) {
    throw new AppError("Ảnh chưa được tải lên trong cuộc trò chuyện này. Vui lòng chọn và tải ảnh lại.", 400);
  }
}

// Chỉ tái sử dụng ảnh của yêu cầu gần nhất, không lấy toàn bộ ảnh từng tải trong phiên.
export function agentRequestAttachments(session: AgentSession | undefined, urls?: string[]) {
  const latest = session?.conversation.slice().reverse().find((message) => message.role === "user");
  const images = bookingAttachmentsSchema.parse(urls ?? latest?.customerAttachments ?? []);
  requireBookingAttachments(session, images);
  return images;
}
