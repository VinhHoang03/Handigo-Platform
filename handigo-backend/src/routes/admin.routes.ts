import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import * as categoryController from "../controllers/category.controller";
import * as complaintController from "../controllers/complaint.controller";
import * as reportController from "../controllers/report.controller";
import * as supportTicketController from "../controllers/supportTicket.controller";
import * as violationController from "../controllers/violation.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  reviewProviderApplicationSchema,
  updateUserStatusSchema,
} from "../validations/admin.validator";
import {
  categoryIdSchema,
  categoryQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "../validations/category.validator";
import {
  complaintIdSchema,
  requestComplaintEvidenceSchema,
  updateComplaintStatusSchema,
} from "../validations/complaint.validator";
import { reportIdSchema, reviewReportSchema } from "../validations/report.validator";
import {
  addSupportTicketResponseSchema,
  assignSupportTicketSchema,
  supportTicketIdSchema,
  updateSupportTicketStatusSchema,
} from "../validations/supportTicket.validator";
import { createViolationSchema, violationIdSchema } from "../validations/violation.validator";

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

router.get("/reports", reportController.getAdminReports);
router.get(
  "/reports/:id",
  validate(reportIdSchema, "params"),
  reportController.getAdminReportById,
);
router.patch(
  "/reports/:id/review",
  validate(reportIdSchema, "params"),
  validate(reviewReportSchema),
  reportController.reviewReport,
);

router.get("/complaints", complaintController.getAdminComplaints);
router.get(
  "/complaints/:id",
  validate(complaintIdSchema, "params"),
  complaintController.getAdminComplaintById,
);
router.patch(
  "/complaints/:id/status",
  validate(complaintIdSchema, "params"),
  validate(updateComplaintStatusSchema),
  complaintController.updateComplaintStatus,
);
router.patch(
  "/complaints/:id/request-evidence",
  validate(complaintIdSchema, "params"),
  validate(requestComplaintEvidenceSchema),
  complaintController.requestEvidence,
);

router.get("/support-tickets", supportTicketController.getAdminSupportTickets);
router.get(
  "/support-tickets/:id",
  validate(supportTicketIdSchema, "params"),
  supportTicketController.getAdminSupportTicketById,
);
router.post(
  "/support-tickets/:id/responses",
  validate(supportTicketIdSchema, "params"),
  validate(addSupportTicketResponseSchema),
  supportTicketController.addSupportTicketResponse,
);
router.patch(
  "/support-tickets/:id/status",
  validate(supportTicketIdSchema, "params"),
  validate(updateSupportTicketStatusSchema),
  supportTicketController.updateSupportTicketStatus,
);
router.patch(
  "/support-tickets/:id/assign",
  validate(supportTicketIdSchema, "params"),
  validate(assignSupportTicketSchema),
  supportTicketController.assignSupportTicket,
);

router.get("/violations", violationController.getAdminViolations);
router.get(
  "/violations/:id",
  validate(violationIdSchema, "params"),
  violationController.getAdminViolationById,
);
router.post(
  "/violations",
  validate(createViolationSchema),
  violationController.createViolation,
);

router.get(
  "/categories",
  validate(categoryQuerySchema, "query"),
  categoryController.getCategories,
);
router.get(
  "/categories/:id",
  validate(categoryIdSchema, "params"),
  categoryController.getCategoryById,
);
router.post(
  "/categories",
  validate(createCategorySchema),
  categoryController.createCategory,
);
router.patch(
  "/categories/:id",
  validate(categoryIdSchema, "params"),
  validate(updateCategorySchema),
  categoryController.updateCategory,
);
router.delete(
  "/categories/:id",
  validate(categoryIdSchema, "params"),
  categoryController.deleteCategory,
);

router.get("/provider-applications", adminController.getProviderApplications);
router.get("/provider-applications/:id", adminController.getProviderApplicationById);
router.patch(
  "/provider-applications/:id/review",
  validate(reviewProviderApplicationSchema),
  adminController.reviewProviderApplication,
);

export default router;
