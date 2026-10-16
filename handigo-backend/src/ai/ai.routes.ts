import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { chatbotRateLimit } from "../middlewares/rateLimit.middleware";
import { validate } from "../middlewares/validate.middleware";
import { deleteSession, getLatestSession, getSession, listSessions, getSessionProgress, resetSession, sendMessage, uploadAttachment } from "./ai.controller";
import { uploadOrderAttachmentImage } from "../middlewares/orderAttachmentUpload.middleware";
import { bookingAttachmentsSchema } from "./agent/booking-attachments";
import { bookingActionSchema } from "./agent/booking-actions";

export const agentRequestSchema = z.union([
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), paymentStatus: z.object({
    orderId: z.string().regex(/^[a-f\d]{24}$/i, "ID đơn hàng không hợp lệ."),
  }).strict() }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), message: z.string().trim().min(1).max(4000),
    customerAttachments: bookingAttachmentsSchema.optional(), bookingAction: bookingActionSchema.optional() }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), confirmation: z.object({
    actionId: z.string().uuid(), decision: z.enum(["CONFIRM", "REJECT"]),
    policyConsent: z.object({ accepted: z.literal(true), version: z.string().regex(/^[a-f\d]{64}$/, "Phiên bản chính sách không hợp lệ.") }).strict().optional(),
  }).strict() }).strict(),
]);
const router = Router();
router.use(authMiddleware, roleMiddleware("CUSTOMER"));
router.post("/sessions/:sessionId/attachments", chatbotRateLimit, validate(z.object({
  sessionId: z.string().uuid("Mã cuộc trò chuyện không hợp lệ."),
}), "params"), uploadOrderAttachmentImage, uploadAttachment);
router.get("/sessions/latest", getLatestSession);
router.delete("/sessions/:sessionId", validate(z.object({
  sessionId: z.string().uuid("Mã cuộc trò chuyện không hợp lệ."),
}), "params"), deleteSession);
router.get("/sessions", validate(z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}), "query"), listSessions);
router.get("/sessions/:sessionId", validate(z.object({
  sessionId: z.string().uuid("Mã cuộc trò chuyện không hợp lệ."),
}), "params"), getSession);
router.get("/sessions/:sessionId/progress", validate(z.object({
  sessionId: z.string().uuid("Mã phiên trợ lý không hợp lệ."),
}), "params"), getSessionProgress);
router.post("/sessions/reset", chatbotRateLimit, validate(z.object({
  sessionId: z.string().uuid("Mã phiên trợ lý không hợp lệ."),
}).strict()), resetSession);
router.post("/messages", chatbotRateLimit, validate(agentRequestSchema), sendMessage);
export default router;
