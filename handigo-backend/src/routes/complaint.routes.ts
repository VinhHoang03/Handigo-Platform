import { Router } from "express";
import * as complaintController from "../controllers/complaint.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addComplaintEvidenceSchema,
  complaintIdSchema,
  createComplaintSchema,
} from "../validations/complaint.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(createComplaintSchema),
  complaintController.createComplaint,
);
router.get("/me", complaintController.getMyComplaints);
router.get("/:id", validate(complaintIdSchema, "params"), complaintController.getComplaintForUser);
router.patch(
  "/:id/cancel",
  validate(complaintIdSchema, "params"),
  complaintController.cancelComplaint,
);
router.post(
  "/:id/evidence",
  validate(complaintIdSchema, "params"),
  validate(addComplaintEvidenceSchema),
  complaintController.addComplaintEvidence,
);

export default router;
