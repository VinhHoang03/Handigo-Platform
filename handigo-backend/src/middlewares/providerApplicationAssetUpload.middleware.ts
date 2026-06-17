import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../configs/cloudinary";

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
  identity: "identity",
  certificate: "certificates",
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

export const uploadProviderApplicationAsset = (
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
        message: "File is required",
      });
    }

    const purpose = String(req.body?.purpose || req.query?.purpose || "");
    const folder = folderByPurpose[purpose];

    if (!folder) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload purpose",
      });
    }

    try {
      const userId = req.user!.id;
      res.locals.imageUrl = await uploadBuffer(
        req.file.buffer,
        `handigo/provider-applications/${userId}/${folder}`,
      );
      next();
    } catch {
      return res.status(502).json({
        success: false,
        message: "Could not upload file",
      });
    }
  });
};
