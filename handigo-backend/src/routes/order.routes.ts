import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { approvedProviderMiddleware } from "../middlewares/approvedProvider.middleware";
import { uploadOrderAttachmentImage } from "../middlewares/orderAttachmentUpload.middleware";
import { uploadQuotationImage } from "../middlewares/quotationImageUpload.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  dispatchRateLimit,
  ocrRateLimit,
  routingRateLimit,
  uploadRateLimit,
} from "../middlewares/rateLimit.middleware";
import {
  assignmentIdParamSchema,
  cancellationPreviewQuerySchema,
  cancelOrderSchema,
  completeOrderSchema,
  createRepairQuotationSchema,
  createOrderSchema,
  orderIdParamSchema,
  orderListQuerySchema,
  quotationIdParamSchema,
  quotationItemsRelevanceSchema,
  recentOrderQuerySchema,
  reassignmentResponseSchema,
  rejectAssignmentSchema,
  selectAppointmentProviderSchema,
  rejectRepairQuotationSchema,
  trackingRouteQuerySchema,
} from "../validations/order.validator";
import {
  createOrder,
  discardUnpaidOrder,
  getMyOrders,
  getProviderOrders,
  getProviderRecentOrders,
  getOrderById,
  getRecurringSeries,
  cancelOrder,
  previewCancellation,
  cancelRecurringSeries,
  startOrder,
  completeOrder,
  uploadOrderAttachment,
  acceptAssignment,
  rejectAssignment,
  getPendingAssignments,
  getOrderAssignments,
  redispatchOrder,
  createRepairQuotation,
  getRepairQuotation,
  confirmRepairQuotation,
  rejectRepairQuotation,
  selectAppointmentProvider,
  respondToReassignment,
} from "../controllers/order.controller";
import { getOrderTrackingRoute } from "../controllers/orderTracking.controller";
import {
  scanQuotationItems,
  validateQuotationItemsRelevance,
} from "../controllers/quotationImageAnalysis.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ─── Orders ───────────────────────────────────────────────────────────────────

// POST   /orders               → Customer: create new booking order
router.post(
  "/",
  roleMiddleware("CUSTOMER"),
  dispatchRateLimit,
  validate(createOrderSchema),
  createOrder,
);

// GET    /orders               → Customer: list own orders (paginated)
router.get(
  "/",
  roleMiddleware("CUSTOMER"),
  validate(orderListQuerySchema, "query"),
  getMyOrders,
);

// GET    /orders/provider/recent  -> Provider: list newest assigned orders
router.get(
  "/provider/recent",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(recentOrderQuerySchema, "query"),
  getProviderRecentOrders,
);

// GET    /orders/provider          -> Provider: paginated order list
router.get(
  "/provider",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(orderListQuerySchema, "query"),
  getProviderOrders,
);

// GET    /orders/:orderId      → Customer / Provider: view order detail
router.post(
  "/attachments",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  uploadRateLimit,
  uploadOrderAttachmentImage,
  uploadOrderAttachment,
);

router.post(
  "/quotation-items/scan-image",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  ocrRateLimit,
  uploadQuotationImage,
  scanQuotationItems,
);

router.post(
  "/:orderId/quotation-items/validate",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  ocrRateLimit,
  validate(orderIdParamSchema, "params"),
  validate(quotationItemsRelevanceSchema),
  validateQuotationItemsRelevance,
);

router.get(
  "/:orderId/tracking-route",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  routingRateLimit,
  validate(orderIdParamSchema, "params"),
  validate(trackingRouteQuerySchema, "query"),
  getOrderTrackingRoute,
);

router.get("/:orderId", validate(orderIdParamSchema, "params"), getOrderById);

router.get(
  "/:orderId/series",
  roleMiddleware("CUSTOMER"),
  validate(orderIdParamSchema, "params"),
  getRecurringSeries,
);

router.patch(
  "/:orderId/appointment-provider",
  roleMiddleware("CUSTOMER"),
  validate(orderIdParamSchema, "params"),
  validate(selectAppointmentProviderSchema),
  selectAppointmentProvider,
);

// PATCH  /orders/:orderId/cancel → Customer / Provider / Admin: cancel order
router.patch(
  "/:orderId/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  cancelOrder,
);

router.delete(
  "/:orderId/unpaid",
  roleMiddleware("CUSTOMER"),
  validate(orderIdParamSchema, "params"),
  discardUnpaidOrder,
);

router.patch(
  "/:orderId/reassignment-response",
  roleMiddleware("CUSTOMER"),
  validate(orderIdParamSchema, "params"),
  validate(reassignmentResponseSchema),
  respondToReassignment,
);

router.get(
  "/:orderId/cancellation-preview",
  validate(orderIdParamSchema, "params"),
  validate(cancellationPreviewQuerySchema, "query"),
  previewCancellation,
);

router.patch(
  "/:orderId/cancel-series",
  roleMiddleware("CUSTOMER"),
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  cancelRecurringSeries,
);

// POST   /orders/:orderId/start    → Provider: start working on order
router.post(
  "/:orderId/start",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(orderIdParamSchema, "params"),
  startOrder,
);

// POST   /orders/:orderId/complete → Provider: complete order
router.post(
  "/:orderId/complete",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(orderIdParamSchema, "params"),
  validate(completeOrderSchema),
  completeOrder,
);

// ─── Assignments ──────────────────────────────────────────────────────────────

// GET    /orders/assignments/pending  → Provider: see own pending assignments
router.get(
  "/assignments/pending",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  getPendingAssignments,
);

// POST   /orders/assignments/:assignmentId/accept → Provider: accept
router.post(
  "/assignments/:assignmentId/accept",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(assignmentIdParamSchema, "params"),
  acceptAssignment,
);

// POST   /orders/assignments/:assignmentId/reject → Provider: reject
router.post(
  "/assignments/:assignmentId/reject",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  validate(assignmentIdParamSchema, "params"),
  validate(rejectAssignmentSchema),
  rejectAssignment,
);

// GET    /orders/:orderId/assignments → Admin / Owner: assignment history
router.get(
  "/:orderId/assignments",
  roleMiddleware("ADMIN", "CUSTOMER", "PROVIDER"),
  validate(orderIdParamSchema, "params"),
  getOrderAssignments,
);

// ─── Dispatch (Admin) ─────────────────────────────────────────────────────────

// POST   /orders/:orderId/redispatch → Admin: manual re-dispatch
router.post(
  "/:orderId/redispatch",
  roleMiddleware("ADMIN"),
  dispatchRateLimit,
  validate(orderIdParamSchema, "params"),
  redispatchOrder,
);

// ─── Repair Quotation ─────────────────────────────────────────────────────────

// POST   /orders/:orderId/quotations          → Provider: create quotation
router.post(
  "/:orderId/quotations",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  ocrRateLimit,
  validate(orderIdParamSchema, "params"),
  validate(createRepairQuotationSchema),
  createRepairQuotation,
);

// GET    /orders/:orderId/quotation           → Provider: get current quotation
router.get(
  "/:orderId/quotation",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(orderIdParamSchema, "params"),
  getRepairQuotation,
);

// POST   /orders/quotations/:quotationId/confirm → Customer: confirm quotation
router.post(
  "/quotations/:quotationId/confirm",
  roleMiddleware("CUSTOMER"),
  validate(quotationIdParamSchema, "params"),
  confirmRepairQuotation,
);

// POST   /orders/quotations/:quotationId/reject  → Customer: reject quotation
router.post(
  "/quotations/:quotationId/reject",
  roleMiddleware("CUSTOMER"),
  validate(quotationIdParamSchema, "params"),
  validate(rejectRepairQuotationSchema),
  rejectRepairQuotation,
);

export default router;
