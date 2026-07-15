import { Router } from "express";
import * as feedbackController from "../controllers/feedback.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createFeedbackSchema,
  providerReplySchema,
  updateFeedbackSchema,
  visibilitySchema,
} from "../validations/feedback.validator";
import { uploadFeedbackImages } from "../middlewares/feedbackUpload.middleware";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware";

const router = Router();

router.get("/latest", feedbackController.getLatestPublicFeedbacks);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validate(createFeedbackSchema),
  feedbackController.createFeedback,
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
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
  validate(providerReplySchema),
  feedbackController.upsertProviderReply,
);

router.get(
  "/provider/:providerId",
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
