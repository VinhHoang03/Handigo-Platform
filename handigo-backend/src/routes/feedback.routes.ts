import { Router } from "express";
import * as feedbackController from "../controllers/feedback.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createFeedbackSchema,
  feedbackListQuerySchema,
  providerReplySchema,
  updateFeedbackSchema,
  visibilitySchema,
  moderationListSchema,
  moderationIdSchema,
  moderationReviewSchema,
} from "../validations/feedback.validator";
import { uploadFeedbackImages } from "../middlewares/feedbackUpload.middleware";
import { createRateLimit, uploadRateLimit } from "../middlewares/rateLimit.middleware";

const router = Router();
const moderationRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 10,
  message: "Bạn gửi đánh giá quá nhanh. Vui lòng chờ rồi thử lại.",
  keyGenerator: req => req.user!.id });

router.get("/moderation", authMiddleware, roleMiddleware("ADMIN", "CUSTOMER", "PROVIDER"),
  validate(moderationListSchema, "query"), feedbackController.listModeration);
router.patch("/moderation/:id", authMiddleware, roleMiddleware("ADMIN"),
  validate(moderationIdSchema, "params"), validate(moderationReviewSchema), feedbackController.reviewModeration);

router.get("/latest", feedbackController.getLatestPublicFeedbacks);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  moderationRateLimit,
  validate(createFeedbackSchema),
  feedbackController.createFeedback,
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  moderationRateLimit,
  validate(updateFeedbackSchema),
  feedbackController.updateMyFeedback,
);

router.get(
  "/me",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  feedbackController.getMyFeedbacks,
);

router.get(
  "/orders/:orderId/context",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  feedbackController.getOrderFeedbackContext,
);

router.get(
  "/orders/:orderId",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  feedbackController.getFeedbackByOrder,
);

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  uploadRateLimit,
  uploadFeedbackImages,
  feedbackController.uploadFeedbackImages,
);

router.get(
  "/provider/me",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  validate(feedbackListQuerySchema, "query"),
  feedbackController.getMyProviderFeedbacks,
);

router.get(
  "/provider/orders/:orderId",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  feedbackController.getProviderFeedbackByOrder,
);

router.post(
  "/provider/images",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  uploadRateLimit,
  uploadFeedbackImages,
  feedbackController.uploadFeedbackImages,
);

router.put(
  "/:id/reply",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  moderationRateLimit,
  validate(providerReplySchema),
  feedbackController.upsertProviderReply,
);

router.get(
  "/provider/:providerId",
  validate(feedbackListQuerySchema, "query"),
  feedbackController.getProviderFeedbacks,
);

router.patch(
  "/:id/visibility",
  authMiddleware,
  roleMiddleware("ADMIN"),
  validate(visibilitySchema),
  feedbackController.setFeedbackVisibility,
);

export default router;
