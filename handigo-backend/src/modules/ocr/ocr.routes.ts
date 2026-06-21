import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { providerApplicationOcrRateLimit } from "../../middlewares/providerApplicationOcrRateLimit.middleware";
import { extract } from "./ocr.controller";
import { uploadOcrFile } from "./ocr.upload";

const router = Router();

router.post(
  "/extract",
  authMiddleware,
  providerApplicationOcrRateLimit,
  uploadOcrFile,
  extract,
);

export default router;
