import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary, { isCloudinaryConfigured } from "../configs/cloudinary";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Chỉ chấp nhận tệp hình ảnh."));
      return;
    }
    callback(null, true);
  },
}).array("images", 5);

const uploadBuffer = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "handigo/feedbacks", resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });

export const uploadFeedbackImages = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!isCloudinaryConfigured) {
    return res.status(503).json({
      success: false,
      message: "Dịch vụ tải ảnh hiện chưa sẵn sàng.",
    });
  }

  upload(req, res, async (error) => {
    if (error) {
      const message = error instanceof multer.MulterError
        ? error.code === "LIMIT_FILE_SIZE"
          ? "Mỗi ảnh không được vượt quá 5 MB."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Chỉ được tải tối đa 5 ảnh."
            : "Không thể đọc tệp ảnh đã chọn."
        : error.message || "Tệp tải lên không hợp lệ.";
      return res.status(400).json({ success: false, message });
    }

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất một ảnh.",
      });
    }

    try {
      res.locals.imageUrls = await Promise.all(
        files.map((file) => uploadBuffer(file.buffer)),
      );
      next();
    } catch (error) {
      console.error("Không thể tải ảnh đánh giá lên Cloudinary:", error);
      return res.status(502).json({
        success: false,
        message: "Không thể tải ảnh lên. Vui lòng thử lại sau.",
      });
    }
  });
};
