import { Router } from "express";
import { extract } from "../controllers/ocr.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadOcrFile } from "../middlewares/ocrUpload.middleware";
import { ocrRateLimit } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post(
  "/extract",
  authMiddleware,
  ocrRateLimit,
  uploadOcrFile,
  extract,
);

export default router;
