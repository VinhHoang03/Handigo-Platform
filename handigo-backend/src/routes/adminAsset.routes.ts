import { Router } from "express";
import * as adminAssetController from "../controllers/adminAsset.controller";
import { uploadAdminAssetImage } from "../middlewares/adminAssetUpload.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const router = Router();

router.post(
  "/images",
  authMiddleware,
  roleMiddleware("ADMIN"),
  uploadAdminAssetImage,
  adminAssetController.uploadImage,
);

export default router;
