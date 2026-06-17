import { Router } from "express";
import * as providerAssetController from "../controllers/providerAsset.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadProviderApplicationAsset } from "../middlewares/providerApplicationAssetUpload.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const router = Router();

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  uploadProviderApplicationAsset,
  providerAssetController.uploadImage,
);

export default router;
