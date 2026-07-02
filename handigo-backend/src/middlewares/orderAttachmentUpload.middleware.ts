import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../configs/cloudinary";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
}).single("image");

const uploadBuffer = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "handigo/order-attachments", resource_type: "image" },
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

export const uploadOrderAttachmentImage = (
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
        message: "Vui lòng chọn ảnh cần tải lên",
      });
    }

    try {
      res.locals.imageUrl = await uploadBuffer(req.file.buffer);
      next();
    } catch {
      return res.status(502).json({
        success: false,
        message: "Không thể tải ảnh lên",
      });
    }
  });
};
