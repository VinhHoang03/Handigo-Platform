import { Router } from "express";
import {
  createPayment,
  getPaymentById,
  getPaymentHistory,
  getPaymentsByOrder,
  payosWebhook,
} from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema } from "../validations/payment.validation";

const router = Router();

router.post("/create", authMiddleware, validate(createPaymentSchema), createPayment);
router.post("/webhook", payosWebhook);
router.get("/history", authMiddleware, getPaymentHistory);
router.get("/order/:orderId", authMiddleware, getPaymentsByOrder);
router.get("/:id", authMiddleware, getPaymentById);

export default router;
