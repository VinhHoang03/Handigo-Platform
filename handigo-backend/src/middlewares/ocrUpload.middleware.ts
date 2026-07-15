import { NextFunction, Request, Response } from "express";
import multer from "multer";

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

const hasValidSignature = (file: Express.Multer.File) => {
  const bytes = file.buffer;
  if (file.mimetype === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (file.mimetype === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
};

export const uploadOcrFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, (error) => {
    if (!error) {
      if (req.file && !hasValidSignature(req.file)) {
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
