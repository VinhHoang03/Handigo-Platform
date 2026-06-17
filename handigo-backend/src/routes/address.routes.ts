import { Router } from "express";
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getServiceHistory
} from "../controllers/address.controller";

import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../validations/address.validator";

const router = Router();

/**
 * CUSTOMER routes
 */

router.get(
  "/",
  authMiddleware,
  getUserAddresses
);

router.post(
  "/",
  authMiddleware,
  validate(createAddressSchema),
  createAddress
);

router.put(
  "/:id",
  authMiddleware,
  validate(updateAddressSchema),
  updateAddress
);

router.delete(
  "/:id",
  authMiddleware,
  deleteAddress
);

/**
 * service history
 */

router.get(
  "/service-history",
  authMiddleware,
  getServiceHistory
);

export default router;
