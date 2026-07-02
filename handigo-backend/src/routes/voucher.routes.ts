import { Router } from "express";
import {
  applyVoucher,
  createAdminVoucher,
  deleteAdminVoucher,
  disableAdminVoucher,
  enableAdminVoucher,
  getAdminVoucherById,
  getAdminVouchers,
  getAvailableVouchers,
  removeVoucher,
  updateAdminVoucher,
} from "../controllers/voucher.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  applyVoucherSchema,
  createAdminVoucherSchema,
  removeVoucherSchema,
  updateAdminVoucherSchema,
} from "../validations/voucher.validator";

const router = Router();

router.post("/apply", authMiddleware, validate(applyVoucherSchema), applyVoucher);
router.post("/remove", authMiddleware, validate(removeVoucherSchema), removeVoucher);
router.get("/available", authMiddleware, getAvailableVouchers);

router.post("/", authMiddleware, roleMiddleware("ADMIN"), validate(createAdminVoucherSchema), createAdminVoucher);
router.get("/", authMiddleware, roleMiddleware("ADMIN"), getAdminVouchers);
router.get("/:id", authMiddleware, roleMiddleware("ADMIN"), getAdminVoucherById);
router.patch("/:id", authMiddleware, roleMiddleware("ADMIN"), validate(updateAdminVoucherSchema), updateAdminVoucher);
router.patch("/:id/disable", authMiddleware, roleMiddleware("ADMIN"), disableAdminVoucher);
router.patch("/:id/enable", authMiddleware, roleMiddleware("ADMIN"), enableAdminVoucher);
router.delete("/:id", authMiddleware, roleMiddleware("ADMIN"), deleteAdminVoucher);

export default router;
