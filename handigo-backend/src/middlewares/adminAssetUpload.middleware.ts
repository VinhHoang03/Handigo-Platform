import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary, { isCloudinaryConfigured } from "../configs/cloudinary";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  hasValidFileSignature,
} from "../utils/fileSignature";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF hoặc AVIF"));
      return;
    }
    callback(null, true);
  },
}).single("image");

const uploadBuffer = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "handigo/admin-assets", resource_type: "image" },
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

export const uploadAdminAssetImage = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!isCloudinaryConfigured) {
    return res.status(503).json({
      success: false,
      message: "Dịch vụ lưu trữ ảnh chưa được cấu hình đầy đủ",
    });
  }

  upload(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn một tệp ảnh hợp lệ",
      });
    }

    if (!hasValidFileSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tệp không khớp với định dạng ảnh đã khai báo",
      });
    }

    try {
      res.locals.imageUrl = await uploadBuffer(req.file.buffer);
      next();
    } catch {
      return res.status(502).json({
        success: false,
        message: "Không thể tải ảnh lên dịch vụ lưu trữ",
      });
    }
  });
};
