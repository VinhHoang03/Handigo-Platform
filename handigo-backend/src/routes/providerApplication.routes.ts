import { Router } from "express";
import * as providerApplicationController from "../controllers/providerApplication.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createProviderApplicationSchema,
  providerApplicationIdParamSchema,
  saveProviderApplicationDraftSchema,
} from "../validations/providerApplication.validator";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validate(createProviderApplicationSchema),
  providerApplicationController.createApplication,
);

router.get(
  "/me",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  providerApplicationController.getMyApplication,
);

router.get(
  "/me/history",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  providerApplicationController.getMyApplications,
);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(providerApplicationIdParamSchema, "params"),
  providerApplicationController.getMyApplicationById,
);

router.patch(
  "/:id/resubmit",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validate(providerApplicationIdParamSchema, "params"),
  validate(createProviderApplicationSchema),
  providerApplicationController.resubmitApplication,
);

router.patch(
  "/me/draft",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validate(saveProviderApplicationDraftSchema),
  providerApplicationController.saveDraftApplication,
);

export default router;
