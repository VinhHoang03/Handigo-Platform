import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { hasValidFileSignature } from "../utils/fileSignature";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Chỉ chấp nhận tệp JPG, JPEG, PNG hoặc PDF"));
      return;
    }
    callback(null, true);
  },
}).single("file");

export const uploadOcrFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, (error) => {
    if (!error) {
      if (
        req.file &&
        !hasValidFileSignature(req.file.buffer, req.file.mimetype)
      ) {
        return res.status(400).json({
          success: false,
          message: "Nội dung tệp không khớp với định dạng đã khai báo",
        });
      }
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Tệp OCR không được vượt quá 10 MB"
        : error.message || "Không thể tải tệp OCR lên";
    return res.status(400).json({ success: false, message });
  });
};
