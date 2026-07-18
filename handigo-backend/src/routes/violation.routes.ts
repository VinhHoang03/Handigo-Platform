import { Router } from "express";
import * as violationController from "../controllers/violation.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { violationListQuerySchema } from "../validations/violation.validator";

const router = Router();

router.use(authMiddleware);

router.get(
  "/me",
  validate(violationListQuerySchema, "query"),
  violationController.getMyViolations,
);

export default router;
