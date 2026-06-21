import { Router } from "express";
import {
  adjustAdminWallet,
  cancelMyWalletDeposit,
  createMyWalletDeposit,
  getAdminWalletByProviderId,
  getAdminWallets,
  getAdminWalletTransactions,
  getMyWallet,
  getMyWalletSummary,
  getMyWalletTransactions,
  syncMyWalletDeposit,
} from "../controllers/wallet.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { adminWalletAdjustmentSchema, walletDepositSchema } from "../validations/wallet.validator";

const router = Router();

router.get("/me", authMiddleware, roleMiddleware("PROVIDER"), getMyWallet);
router.post(
  "/me/deposit",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  validate(walletDepositSchema),
  createMyWalletDeposit,
);
router.patch(
  "/me/deposit/:orderCode/cancel",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  cancelMyWalletDeposit,
);
router.patch(
  "/me/deposit/:orderCode/sync",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  syncMyWalletDeposit,
);
router.get(
  "/me/transactions",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  getMyWalletTransactions,
);
router.get(
  "/me/summary",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  getMyWalletSummary,
);

router.get("/admin", authMiddleware, roleMiddleware("ADMIN"), getAdminWallets);
router.get(
  "/admin/:providerId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getAdminWalletByProviderId,
);
router.get(
  "/admin/:providerId/transactions",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getAdminWalletTransactions,
);
router.patch(
  "/admin/:providerId/adjust",
  authMiddleware,
  roleMiddleware("ADMIN"),
  validate(adminWalletAdjustmentSchema),
  adjustAdminWallet,
);

export default router;
