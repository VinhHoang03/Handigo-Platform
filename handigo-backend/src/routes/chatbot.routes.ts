import { Router } from "express";
import * as chatbotController from "../controllers/chatbot.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { chatbotRateLimit } from "../middlewares/rateLimit.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  chatbotHistoryQuerySchema,
  sendChatbotMessageSchema,
} from "../validations/chatbot.validator";

const router = Router();

router.use(authMiddleware, roleMiddleware("CUSTOMER", "PROVIDER"));
router.get(
  "/messages",
  validate(chatbotHistoryQuerySchema, "query"),
  chatbotController.getMessages,
);
router.post(
  "/messages",
  chatbotRateLimit,
  validate(sendChatbotMessageSchema),
  chatbotController.sendMessage,
);

export default router;
