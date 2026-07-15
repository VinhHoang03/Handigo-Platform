import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../configs/cloudinary";
import {
  extractDocumentSuggestion,
  OcrDocumentKind,
} from "../services/ocr.service";
import { createLogger } from "../utils/logger";

const providerApplicationAssetLogger = createLogger("ProviderApplicationAssetUpload");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const folderByPurpose: Record<string, string> = {
  identity: "identity",
  certificate: "certificates",
};

const ocrKinds = new Set<OcrDocumentKind>([
  "cccd_front",
  "cccd_back",
  "passport",
  "certificate",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Chỉ chấp nhận ảnh, PDF, DOC và DOCX"));
      return;
    }

    callback(null, true);
  },
}).single("image");

const uploadBuffer = (buffer: Buffer, folder: string) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Tải tệp lên Cloudinary thất bại"));
          return;
        }

        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });

export const uploadProviderApplicationAsset = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn tệp cần tải lên",
      });
    }

    const purpose = String(req.body?.purpose || req.query?.purpose || "");
    const folder = folderByPurpose[purpose];

    if (!folder) {
      return res.status(400).json({
        success: false,
        message: "Mục đích tải tệp không hợp lệ",
      });
    }

    try {
      const requestedKind = String(req.body?.documentKind || "");
      const kind = ocrKinds.has(requestedKind as OcrDocumentKind)
        ? (requestedKind as OcrDocumentKind)
        : undefined;
      const kindMatchesPurpose =
        !kind ||
        (purpose === "certificate" && kind === "certificate") ||
        (purpose === "identity" && kind !== "certificate");
      if (!kindMatchesPurpose) {
        return res.status(400).json({
          success: false,
          message: "Loại tài liệu OCR không phù hợp với mục đích tải tệp",
        });
      }

      const userId = req.user!.id;
      res.locals.imageUrl = await uploadBuffer(
        req.file.buffer,
        `handigo/provider-applications/${userId}/${folder}`,
      );

      const supportsOcr = req.file.mimetype.startsWith("image/") || req.file.mimetype === "application/pdf";

      if (kind && supportsOcr) {
        try {
          res.locals.ocrSuggestion = await extractDocumentSuggestion(
            req.file.buffer,
            req.file.mimetype,
            kind,
          );
          if (process.env.NODE_ENV !== "production") {
            providerApplicationAssetLogger.info("Google Cloud Vision OCR thành công.", {
              kind,
              mimetype: req.file.mimetype,
            });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Lỗi OCR không xác định";
          providerApplicationAssetLogger.error("Google Cloud Vision OCR thất bại.", error, {
            message,
          });
          res.locals.ocrSuggestion = {
            warnings: ["Không thể đọc tài liệu bằng OCR. Vui lòng nhập thông tin thủ công."],
          };
        }
      } else if (kind) {
        res.locals.ocrSuggestion = {
          warnings: ["Định dạng này không hỗ trợ OCR. Vui lòng nhập thông tin thủ công."],
        };
      }
      next();
    } catch {
      return res.status(502).json({
        success: false,
        message: "Không thể tải tệp lên",
      });
    }
  });
};
