import { Router } from "express";
import * as providerAssetController from "../controllers/providerAsset.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadProviderAssetImage } from "../middlewares/providerAssetUpload.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  uploadRateLimit,
  uploadProviderAssetImage,
  providerAssetController.uploadImage,
);

export default router;
