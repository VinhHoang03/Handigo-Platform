import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { chatbotRateLimit } from "../middlewares/rateLimit.middleware";
import { validate } from "../middlewares/validate.middleware";
import { deleteSession, getLatestSession, getSession, listSessions, getSessionProgress, resetSession, sendMessage, uploadAttachment, requireAttachmentSupport } from "./ai.controller";
import { uploadOrderAttachmentImage } from "../middlewares/orderAttachmentUpload.middleware";
import { agentRequestSchema } from "./ai.validation";
import { AGENT_HTTP_TIMEOUT_MS } from "./agent/runtime-limits";
export { agentRequestSchema } from "./ai.validation";

const router = Router();
router.use(authMiddleware, roleMiddleware("CUSTOMER"));
router.post("/sessions/:sessionId/attachments", chatbotRateLimit, validate(z.object({
  sessionId: z.string().uuid("Mã cuộc trò chuyện không hợp lệ."),
}), "params"), requireAttachmentSupport, uploadOrderAttachmentImage, uploadAttachment);
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
router.post("/messages", chatbotRateLimit, validate(agentRequestSchema), (req, res, next) => {
  req.setTimeout(AGENT_HTTP_TIMEOUT_MS);
  res.setTimeout(AGENT_HTTP_TIMEOUT_MS);
  next();
}, sendMessage);
export default router;
