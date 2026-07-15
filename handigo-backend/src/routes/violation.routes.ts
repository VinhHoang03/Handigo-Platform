import { Router } from "express";
import * as violationController from "../controllers/violation.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/me", violationController.getMyViolations);

export default router;
