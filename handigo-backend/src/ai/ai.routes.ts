import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { chatbotRateLimit } from "../middlewares/rateLimit.middleware";
import { validate } from "../middlewares/validate.middleware";
import { getLatestSession, resetSession, sendMessage } from "./ai.controller";

export const agentRequestSchema = z.union([
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), paymentStatus: z.object({
    orderId: z.string().regex(/^[a-f\d]{24}$/i, "ID đơn hàng không hợp lệ."),
  }).strict() }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), message: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), confirmation: z.object({
    actionId: z.string().uuid(), decision: z.enum(["CONFIRM", "REJECT"]),
  }).strict() }).strict(),
]);
const router = Router();
router.use(authMiddleware, roleMiddleware("CUSTOMER"));
router.get("/sessions/latest", getLatestSession);
router.post("/sessions/reset", chatbotRateLimit, validate(z.object({
  sessionId: z.string().uuid("Mã phiên trợ lý không hợp lệ."),
}).strict()), resetSession);
router.post("/messages", chatbotRateLimit, validate(agentRequestSchema), sendMessage);
export default router;
