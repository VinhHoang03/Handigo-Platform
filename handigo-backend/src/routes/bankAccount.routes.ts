import { Router } from "express";
import {
  createMyBankAccount,
  deleteMyBankAccount,
  listMyBankAccounts,
  setDefaultMyBankAccount,
  updateMyBankAccount,
} from "../controllers/bankAccount.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
} from "../validations/bankAccount.validator";

const router = Router();

router.get("/", authMiddleware, roleMiddleware("CUSTOMER", "PROVIDER"), listMyBankAccounts);
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(createBankAccountSchema),
  createMyBankAccount,
);
router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(updateBankAccountSchema),
  updateMyBankAccount,
);
router.patch(
  "/:id/default",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  setDefaultMyBankAccount,
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER", "PROVIDER"),
  deleteMyBankAccount,
);

export default router;
