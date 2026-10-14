import { Router } from "express";
import * as adminAssetController from "../controllers/adminAsset.controller";
import { uploadAdminAssetImage } from "../middlewares/adminAssetUpload.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware";

import { uploadServiceImage } from "../middlewares/serviceImageUpload.middleware";

const router = Router();
router.post(
  "/service-images",
  authMiddleware,
  roleMiddleware("ADMIN"),
  uploadRateLimit,
  uploadServiceImage,
  adminAssetController.uploadImage,
);

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("ADMIN"),
  uploadRateLimit,
  uploadAdminAssetImage,
  adminAssetController.uploadImage,
);

export default router;
