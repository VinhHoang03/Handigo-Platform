import { Router } from "express";
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getServiceHistory
} from "../controllers/address.controller";

import { authMiddleware } from "../middlewares/auth.middleware";

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
  createAddress
);

router.put(
  "/:id",
  authMiddleware,
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