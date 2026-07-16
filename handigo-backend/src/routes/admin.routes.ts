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
  adminEntityIdParamSchema,
  adminUserListQuerySchema,
  providerApplicationIdParamSchema,
  providerApplicationListQuerySchema,
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
  complaintListQuerySchema,
  requestComplaintEvidenceSchema,
  updateComplaintStatusSchema,
} from "../validations/complaint.validator";
import {
  reportIdSchema,
  reportListQuerySchema,
  reviewReportSchema,
} from "../validations/report.validator";
import {
  addSupportTicketResponseSchema,
  assignSupportTicketSchema,
  supportTicketIdSchema,
  supportTicketListQuerySchema,
  updateSupportTicketStatusSchema,
} from "../validations/supportTicket.validator";
import {
  createViolationSchema,
  violationIdSchema,
  violationListQuerySchema,
} from "../validations/violation.validator";
import { feedbackListQuerySchema } from "../validations/feedback.validator";

const router = Router();

router.use(authMiddleware, roleMiddleware("ADMIN"));

router.get(
  "/users",
  validate(adminUserListQuerySchema, "query"),
  adminController.getUsers,
);
router.get(
  "/users/:id",
  validate(adminEntityIdParamSchema, "params"),
  adminController.getUserById,
);
router.patch(
  "/users/:id/status",
  validate(adminEntityIdParamSchema, "params"),
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);

router.get(
  "/feedbacks",
  validate(feedbackListQuerySchema, "query"),
  adminController.getFeedbacks,
);

router.get(
  "/reports",
  validate(reportListQuerySchema, "query"),
  reportController.getAdminReports,
);
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

router.get(
  "/complaints",
  validate(complaintListQuerySchema, "query"),
  complaintController.getAdminComplaints,
);
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

router.get(
  "/support-tickets",
  validate(supportTicketListQuerySchema, "query"),
  supportTicketController.getAdminSupportTickets,
);
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

router.get(
  "/violations",
  validate(violationListQuerySchema, "query"),
  violationController.getAdminViolations,
);
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

router.get(
  "/provider-applications",
  validate(providerApplicationListQuerySchema, "query"),
  adminController.getProviderApplications,
);
router.get(
  "/provider-applications/:id",
  validate(providerApplicationIdParamSchema, "params"),
  adminController.getProviderApplicationById,
);
router.patch(
  "/provider-applications/:id/review",
  validate(providerApplicationIdParamSchema, "params"),
  validate(reviewProviderApplicationSchema),
  adminController.reviewProviderApplication,
);

export default router;
