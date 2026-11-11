import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary, { isCloudinaryConfigured } from "../configs/cloudinary";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { analyzeOrderProblemImage } from "../services/orderAttachmentImageAnalysis.service";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  hasValidFileSignature,
} from "../utils/fileSignature";

const ORDER_PROBLEM_PURPOSE = "order_problem";
const uploadLogger = createLogger("OrderAttachmentUpload");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF hoặc AVIF"));
      return;
    }
    callback(null, true);
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
  const startedAt = performance.now();
  let stage = "receive";
  let stageStartedAt = startedAt;
  const durations: Record<string, number> = {};
  const beginStage = (nextStage: string) => {
    const now = performance.now();
    durations[`${stage}Ms`] = Math.round(now - stageStartedAt);
    stage = nextStage;
    stageStartedAt = now;
  };
  res.once("finish", () => {
    beginStage("finished");
    uploadLogger.info("Thời gian xử lý ảnh mô tả.", {
      ...durations,
      totalMs: Math.round(performance.now() - startedAt),
      bytes: req.file?.size,
      statusCode: res.statusCode,
    });
  });
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

    if (!hasValidFileSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Nội dung tệp không khớp với định dạng ảnh đã khai báo",
      });
    }

    const purpose = String(req.body?.purpose || "");
    if (purpose && purpose !== ORDER_PROBLEM_PURPOSE) {
      return res.status(400).json({
        success: false,
        message: "Mục đích tải ảnh không hợp lệ",
      });
    }

    if (shouldAnalyzeOrderProblemImage(req)) {
      beginStage("analysis");
      try {
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
      } catch (error) {
        uploadLogger.error("Không thể kiểm tra ảnh mô tả.", undefined, {
          stage: "analysis",
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return res.status(503).json({
          success: false,
          message: error instanceof AppError
            ? error.message
            : "Dịch vụ kiểm tra ảnh đang gặp sự cố. Vui lòng thử lại sau.",
        });
      }
    }

    beginStage("storage");
    try {
      if (!isCloudinaryConfigured) {
        throw new AppError("Hệ thống chưa cấu hình kho lưu ảnh. Vui lòng liên hệ hỗ trợ.", 502);
      }
      res.locals.imageUrl = await uploadBuffer(req.file.buffer);
      next();
    } catch (uploadError) {
      const upstreamStatus = (uploadError as { http_code?: number } | null)?.http_code;
      uploadLogger.error("Không thể lưu ảnh mô tả lên kho ảnh.", undefined, {
        stage: "storage",
        upstreamStatus,
        errorType: uploadError instanceof Error ? uploadError.name : "UnknownError",
      });
      return res.status(502).json({
        success: false,
        message: uploadError instanceof AppError
          ? uploadError.message
          : upstreamStatus === 401 || upstreamStatus === 403
            ? "Kho lưu ảnh đang lỗi xác thực hoặc quyền truy cập. Vui lòng liên hệ hỗ trợ."
            : "Không thể lưu ảnh lên hệ thống. Vui lòng thử lại sau.",
      });
    }
  });
};
