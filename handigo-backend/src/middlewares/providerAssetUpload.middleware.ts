import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../configs/cloudinary";
import { Provider } from "../models/provider.model";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const folderByPurpose: Record<string, string> = {
  identity: "provider-documents",
  certificate: "provider-certificates",
  portfolio: "provider-portfolio",
  avatar: "provider-avatars",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only images, PDF, DOC, and DOCX files are allowed"));
      return;
    }

    callback(null, true);
  },
}).single("image");

const uploadBuffer = (buffer: Buffer, folder: string) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
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

export const uploadProviderAssetImage = (
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
        message: "Image is required",
      });
    }

    const purpose = String(req.body?.purpose || req.query?.purpose || "");
    const folderPrefix = folderByPurpose[purpose];

    if (!folderPrefix) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload purpose",
      });
    }

    try {
      const provider = await Provider.findOne({
        userId: req.user?.id,
        isDeleted: false,
      }).select("_id");

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
      }

      const folder = `handigo/${folderPrefix}/${provider._id.toString()}`;
      res.locals.imageUrl = await uploadBuffer(req.file.buffer, folder);
      next();
    } catch {
      return res.status(502).json({
        success: false,
        message: "Could not upload image",
      });
    }
  });
};
