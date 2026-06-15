import { Router } from "express";
import * as providerApplicationController from "../controllers/providerApplication.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createProviderApplicationSchema } from "../validations/providerApplication.validator";

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

export default router;
