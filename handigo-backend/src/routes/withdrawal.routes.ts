import { Router } from "express";
import {
  approveWithdrawal,
  createWithdrawal,
  getAdminWithdrawalById,
  getAdminWithdrawals,
  getMyWithdrawalById,
  getMyWithdrawals,
  rejectWithdrawal,
} from "../controllers/withdrawal.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createWithdrawalSchema } from "../validations/withdrawal.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(createWithdrawalSchema),
  createWithdrawal,
);
router.get("/me", authMiddleware, roleMiddleware("CUSTOMER", "PROVIDER"), getMyWithdrawals);

router.get("/admin", authMiddleware, roleMiddleware("ADMIN"), getAdminWithdrawals);
router.get(
  "/admin/:id",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getAdminWithdrawalById,
);
router.patch(
  "/admin/:id/approve",
  authMiddleware,
  roleMiddleware("ADMIN"),
  approveWithdrawal,
);
router.patch(
  "/admin/:id/reject",
  authMiddleware,
  roleMiddleware("ADMIN"),
  rejectWithdrawal,
);

router.get("/:id", authMiddleware, roleMiddleware("CUSTOMER", "PROVIDER"), getMyWithdrawalById);

export default router;
