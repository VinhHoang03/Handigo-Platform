import { Request, Response, NextFunction } from "express";
import cloudinary from "../configs/cloudinary";
import fs from "fs";
import { createLogger } from "../utils/logger";

const cloudinaryLogger = createLogger("CloudinaryUpload");

export const uploadImageToCloudinary = (folder: string = "images") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) return next();

    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder,
      });

      (req as any).imageUrl = result.secure_url;
      (req as any).publicId = result.public_id;

      // xóa file local
      fs.unlinkSync(req.file.path);

      next();
    } catch (err) {
      cloudinaryLogger.error("Không thể tải tệp lên Cloudinary.", err);
      return res.status(500).json({
        message: "Tải tệp thất bại",
      });
    }
  };
};
