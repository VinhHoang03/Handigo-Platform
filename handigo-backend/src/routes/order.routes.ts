import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  acceptAssignment,
  rejectAssignment,
  getPendingAssignments,
  getOrderAssignments,
  redispatchOrder,
  createRepairQuotation,
  confirmRepairQuotation,
  rejectRepairQuotation,
} from "../controllers/order.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ─── Orders ───────────────────────────────────────────────────────────────────

// POST   /orders               → Customer: create new booking order
router.post("/", roleMiddleware("CUSTOMER"), createOrder);

// GET    /orders               → Customer: list own orders (paginated)
router.get("/", roleMiddleware("CUSTOMER"), getMyOrders);

// GET    /orders/:orderId      → Customer / Provider: view order detail
router.get("/:orderId", getOrderById);

// PATCH  /orders/:orderId/cancel → Customer / Provider / Admin: cancel order
router.patch("/:orderId/cancel", cancelOrder);

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
  acceptAssignment,
);

// POST   /orders/assignments/:assignmentId/reject → Provider: reject
router.post(
  "/assignments/:assignmentId/reject",
  roleMiddleware("PROVIDER"),
  rejectAssignment,
);

// GET    /orders/:orderId/assignments → Admin / Owner: assignment history
router.get("/:orderId/assignments", getOrderAssignments);

// ─── Dispatch (Admin) ─────────────────────────────────────────────────────────

// POST   /orders/:orderId/redispatch → Admin: manual re-dispatch
router.post(
  "/:orderId/redispatch",
  roleMiddleware("ADMIN"),
  redispatchOrder,
);

// ─── Repair Quotation ─────────────────────────────────────────────────────────

// POST   /orders/:orderId/quotations          → Provider: create quotation
router.post(
  "/:orderId/quotations",
  roleMiddleware("PROVIDER"),
  createRepairQuotation,
);

// POST   /orders/quotations/:quotationId/confirm → Customer: confirm quotation
router.post(
  "/quotations/:quotationId/confirm",
  roleMiddleware("CUSTOMER"),
  confirmRepairQuotation,
);

// POST   /orders/quotations/:quotationId/reject  → Customer: reject quotation
router.post(
  "/quotations/:quotationId/reject",
  roleMiddleware("CUSTOMER"),
  rejectRepairQuotation,
);

export default router;
