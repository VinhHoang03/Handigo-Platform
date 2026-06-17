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

router.get("/", authMiddleware, roleMiddleware("PROVIDER"), listMyBankAccounts);
router.post(
  "/",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  validate(createBankAccountSchema),
  createMyBankAccount,
);
router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  validate(updateBankAccountSchema),
  updateMyBankAccount,
);
router.patch(
  "/:id/default",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  setDefaultMyBankAccount,
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  deleteMyBankAccount,
);

export default router;
