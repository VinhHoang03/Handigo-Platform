import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createReportSchema, reportIdSchema } from "../validations/report.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(createReportSchema),
  reportController.createReport,
);
router.get("/me", reportController.getMyReports);
router.get("/:id", validate(reportIdSchema, "params"), reportController.getReportForUser);

export default router;
