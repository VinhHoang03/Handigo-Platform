import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../configs/cloudinary";
import { analyzeOrderProblemImage } from "../services/orderAttachmentImageAnalysis.service";

const ORDER_PROBLEM_PURPOSE = "order_problem";

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

const shouldAnalyzeOrderProblemImage = (req: Request) =>
  req.body?.purpose === ORDER_PROBLEM_PURPOSE;

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
      if (shouldAnalyzeOrderProblemImage(req)) {
        const analysis = await analyzeOrderProblemImage(
          req.file.buffer,
          req.file.mimetype,
        );

        if (!analysis.isRelevant) {
          return res.status(400).json({
            success: false,
            message: analysis.reason,
            data: { analysis },
          });
        }

        res.locals.imageAnalysis = analysis;
      }

      res.locals.imageUrl = await uploadBuffer(req.file.buffer);
      next();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Không thể phân tích ảnh.";
      const isGeminiError = message.includes("GEMINI") || message.includes("Gemini");

      return res.status(isGeminiError ? 503 : 502).json({
        success: false,
        message: "Không thể tải ảnh lên",
      });
    }
  });
};
