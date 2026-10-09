import { Request, Response, NextFunction } from "express";
import multer from "multer";
import cloudinary, { isCloudinaryConfigured } from "../configs/cloudinary";
import { hasValidFileSignature } from "../utils/fileSignature";
import { validateServiceImageMetadata } from "../services/serviceImage.service";
import { AppError } from "../utils/appError";
import { UploadApiResponse } from "cloudinary";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single("image");
export const uploadServiceImage = (req: Request, res: Response, next: NextFunction) => {
  if (!isCloudinaryConfigured) return res.status(503).json({ success: false, message: "Dịch vụ lưu trữ ảnh chưa được cấu hình" });
  upload(req, res, async error => {
    if (error) return res.status(400).json({ success: false, message: "Ảnh tối đa 5 MB; mỗi lần chỉ tải một ảnh" });
    const file = req.file;
    if (!file || file.mimetype !== "image/png" || !hasValidFileSignature(file.buffer, "image/png") || file.buffer.length < 33 || file.buffer.toString("ascii", 12, 16) !== "IHDR") {
      return res.status(400).json({ success: false, message: "Vui lòng xác nhận cắt ảnh trước khi tải lên (PNG)" });
    }
    let asset: UploadApiResponse | undefined;
    try {
      validateServiceImageMetadata({ width: file.buffer.readUInt32BE(16), height: file.buffer.readUInt32BE(20), bytes: file.size, format: "png" });
      asset = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "handigo/service-images", resource_type: "image", format: "png" }, (err, result) => err || !result ? reject(err) : resolve(result));
        stream.end(file.buffer);
      });
      validateServiceImageMetadata(asset);
      res.locals.imageUrl = asset.secure_url;
      next();
    } catch (err) {
      if (asset) await cloudinary.uploader.destroy(asset.public_id).catch(() => undefined);
      return res.status(400).json({ success: false, message: err instanceof AppError ? err.message : "Không thể xử lý ảnh dịch vụ" });
    }
  });
};
