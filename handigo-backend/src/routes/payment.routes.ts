import { Router } from "express";
import {
  createPayment,
  getPaymentById,
  getPaymentHistory,
  getPaymentsByOrder,
  payosWebhook,
  reconcilePayosPaymentByOrder,
  retryPayosRefund,
} from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema } from "../validations/payment.validator";
import { paymentRateLimit } from "../middlewares/rateLimit.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { paymentIdParamSchema } from "../validations/payment.validator";

const router = Router();

router.post(
  "/create",
  authMiddleware,
  paymentRateLimit,
  validate(createPaymentSchema),
  createPayment,
);
router.post("/webhook", payosWebhook);
router.get("/history", authMiddleware, getPaymentHistory);
router.post(
  "/order/:orderId/reconcile",
  authMiddleware,
  paymentRateLimit,
  reconcilePayosPaymentByOrder,
);
router.get("/order/:orderId", authMiddleware, getPaymentsByOrder);
router.post(
  "/:id/refund/retry",
  authMiddleware,
  roleMiddleware("ADMIN"),
  paymentRateLimit,
  validate(paymentIdParamSchema, "params"),
  retryPayosRefund,
);
router.get("/:id", authMiddleware, getPaymentById);

export default router;
