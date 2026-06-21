import { Router } from "express";
import * as chatController from "../controllers/chat.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { reportConversationSchema, sendMessageSchema, updateMessageSchema } from "../validations/chat.validator";

const router = Router();

router.use(authMiddleware);

router.get("/conversations", chatController.getMyConversations);
router.get("/orders/:orderId/conversation", chatController.getOrCreateConversationByOrder);
router.get("/conversations/:conversationId/messages", chatController.getMessages);
router.post(
  "/conversations/:conversationId/messages",
  validate(sendMessageSchema),
  chatController.sendMessage,
);
router.patch("/conversations/:conversationId/seen", chatController.markConversationSeen);
router.post(
  "/conversations/:conversationId/report",
  validate(reportConversationSchema),
  chatController.reportConversation,
);
router.patch(
  "/messages/:messageId",
  validate(updateMessageSchema),
  chatController.updateMessage,
);
router.delete("/messages/:messageId", chatController.deleteMessage);

export default router;
