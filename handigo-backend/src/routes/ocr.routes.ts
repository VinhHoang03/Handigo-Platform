import { Router } from "express";
import { extract } from "../controllers/ocr.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadOcrFile } from "../middlewares/ocrUpload.middleware";
import { providerApplicationOcrRateLimit } from "../middlewares/providerApplicationOcrRateLimit.middleware";

const router = Router();

router.post(
  "/extract",
  authMiddleware,
  providerApplicationOcrRateLimit,
  uploadOcrFile,
  extract,
);

export default router;
