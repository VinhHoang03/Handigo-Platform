import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { hasValidFileSignature } from "../utils/fileSignature";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP"));
      return;
    }
    callback(null, true);
  },
}).single("image");

export const uploadQuotationImage = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, (error) => {
    if (error) {
      const message =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Ảnh hạng mục không được vượt quá 10 MB"
          : error.message || "Không thể tải ảnh hạng mục lên";
      return res.status(400).json({ success: false, message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ảnh hạng mục cần quét",
      });
    }

    if (!hasValidFileSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tệp không khớp với định dạng ảnh đã khai báo",
      });
    }

    return next();
  });
};
