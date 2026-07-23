import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { hasValidFileSignature } from "../utils/fileSignature";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const SPREADSHEET_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const isSpreadsheetFile = (file: Express.Multer.File) =>
  file.originalname.toLowerCase().endsWith(".xlsx") &&
  [SPREADSHEET_MIME_TYPE, "application/octet-stream", "application/zip"].includes(
    file.mimetype,
  );

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype) && !isSpreadsheetFile(file)) {
      callback(new Error("Chỉ chấp nhận ảnh JPG, JPEG, PNG, WebP hoặc tệp Excel .xlsx"));
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
          ? "Tệp hạng mục không được vượt quá 10 MB"
          : error.message || "Không thể tải tệp hạng mục lên";
      return res.status(400).json({ success: false, message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ảnh hoặc tệp Excel chứa hạng mục",
      });
    }

    const signatureMimeType = isSpreadsheetFile(req.file)
      ? SPREADSHEET_MIME_TYPE
      : req.file.mimetype;
    if (!hasValidFileSignature(req.file.buffer, signatureMimeType)) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tệp không khớp với định dạng đã khai báo",
      });
    }

    return next();
  });
};
