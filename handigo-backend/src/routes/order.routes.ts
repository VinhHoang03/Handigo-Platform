import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { uploadOrderAttachmentImage } from "../middlewares/orderAttachmentUpload.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  dispatchRateLimit,
  routingRateLimit,
  uploadRateLimit,
} from "../middlewares/rateLimit.middleware";
import {
  assignmentIdParamSchema,
  cancelOrderSchema,
  completeOrderSchema,
  createRepairQuotationSchema,
  createOrderSchema,
  orderIdParamSchema,
  orderListQuerySchema,
  quotationIdParamSchema,
  recentOrderQuerySchema,
  rejectAssignmentSchema,
  rejectRepairQuotationSchema,
  trackingRouteQuerySchema,
} from "../validations/order.validator";
import {
  createOrder,
  getMyOrders,
  getProviderOrders,
  getProviderRecentOrders,
  getOrderById,
  cancelOrder,
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
} from "../controllers/order.controller";
import { getOrderTrackingRoute } from "../controllers/orderTracking.controller";

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
  validate(recentOrderQuerySchema, "query"),
  getProviderRecentOrders,
);

// GET    /orders/provider          -> Provider: paginated order list
router.get(
  "/provider",
  roleMiddleware("PROVIDER"),
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

router.get(
  "/:orderId/tracking-route",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  routingRateLimit,
  validate(orderIdParamSchema, "params"),
  validate(trackingRouteQuerySchema, "query"),
  getOrderTrackingRoute,
);

router.get("/:orderId", validate(orderIdParamSchema, "params"), getOrderById);

// PATCH  /orders/:orderId/cancel → Customer / Provider / Admin: cancel order
router.patch(
  "/:orderId/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  cancelOrder,
);

// POST   /orders/:orderId/start    → Provider: start working on order
router.post(
  "/:orderId/start",
  roleMiddleware("PROVIDER"),
  validate(orderIdParamSchema, "params"),
  startOrder,
);

// POST   /orders/:orderId/complete → Provider: complete order
router.post(
  "/:orderId/complete",
  roleMiddleware("PROVIDER"),
  validate(orderIdParamSchema, "params"),
  validate(completeOrderSchema),
  completeOrder,
);

// ─── Assignments ──────────────────────────────────────────────────────────────

// GET    /orders/assignments/pending  → Provider: see own pending assignments
router.get(
  "/assignments/pending",
  roleMiddleware("PROVIDER"),
  getPendingAssignments,
);

// POST   /orders/assignments/:assignmentId/accept → Provider: accept
router.post(
  "/assignments/:assignmentId/accept",
  roleMiddleware("PROVIDER"),
  validate(assignmentIdParamSchema, "params"),
  acceptAssignment,
);

// POST   /orders/assignments/:assignmentId/reject → Provider: reject
router.post(
  "/assignments/:assignmentId/reject",
  roleMiddleware("PROVIDER"),
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
