import { Router } from "express";
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getServiceHistory,
  checkAddressUpdate,
  confirmAddressUpdate,
} from "../controllers/address.controller";

import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addressIdParamSchema,
  createAddressSchema,
  updateAddressSchema,
  mapAddressCandidateSchema,
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
  validate(addressIdParamSchema, "params"),
  validate(updateAddressSchema),
  updateAddress
);

router.post(
  "/:id/verification",
  authMiddleware,
  validate(addressIdParamSchema, "params"),
  validate(mapAddressCandidateSchema),
  checkAddressUpdate,
);

router.patch(
  "/:id/verification",
  authMiddleware,
  validate(addressIdParamSchema, "params"),
  validate(mapAddressCandidateSchema),
  confirmAddressUpdate,
);

router.delete(
  "/:id",
  authMiddleware,
  validate(addressIdParamSchema, "params"),
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
