import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ALLOWED_IMAGE_MIME_TYPES, hasValidFileSignature } from "../utils/fileSignature";
import { AppError } from "../utils/appError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) return callback(new AppError("Chỉ chấp nhận tệp hình ảnh.", 400));
    callback(null, true);
  },
}).single("image");

export const uploadCustomerNoShowEvidence = (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, (error) => {
    if (error) return next(new AppError("Không thể nhận ảnh. Mỗi lần chọn một ảnh, tối đa 5 MB.", 400));
    if (!req.file || !hasValidFileSignature(req.file.buffer, req.file.mimetype)) {
      return next(new AppError("Vui lòng gửi ảnh có nội dung và định dạng hợp lệ.", 400));
    }
    next();
  });
};
