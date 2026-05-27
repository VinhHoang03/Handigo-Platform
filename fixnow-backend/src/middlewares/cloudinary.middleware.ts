// middlewares/cloudinary.middleware.ts
import { Request, Response, NextFunction } from "express";
import cloudinary from "../configs/cloudinary";
import fs from "fs";

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
      console.error("Cloudinary error:", err);
      return res.status(500).json({
        message: "Upload failed",
      });
    }
  };
};