import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  reviewProviderApplicationSchema,
  updateUserStatusSchema,
} from "../validations/admin.validator";

const router = Router();

router.use(authMiddleware, roleMiddleware("ADMIN"));

router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.patch(
  "/users/:id/status",
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);

router.get("/feedbacks", adminController.getFeedbacks);

router.get("/provider-applications", adminController.getProviderApplications);
router.get("/provider-applications/:id", adminController.getProviderApplicationById);
router.patch(
  "/provider-applications/:id/review",
  validate(reviewProviderApplicationSchema),
  adminController.reviewProviderApplication,
);

export default router;
