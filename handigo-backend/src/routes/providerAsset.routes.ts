import { Router } from "express";
import * as providerAssetController from "../controllers/providerAsset.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadProviderAssetImage } from "../middlewares/providerAssetUpload.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const router = Router();

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  uploadProviderAssetImage,
  providerAssetController.uploadImage,
);

export default router;
