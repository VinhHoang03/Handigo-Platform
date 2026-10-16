import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../utils/appError";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => callback(null, ["audio/wav", "audio/x-wav"].includes(file.mimetype)),
}).single("audio");

// Chỉ nhận PCM mono 16 kHz do trình duyệt mã hóa; kiểm tra kích thước thực thay vì tin MIME/đuôi tệp.
export function validQuotationAudio(buffer: Buffer) {
  return buffer.length >= 44 && buffer.length <= 44 + 90 * 32_000
    && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.readUInt32LE(4) === buffer.length - 8
    && buffer.toString("ascii", 8, 12) === "WAVE" && buffer.toString("ascii", 12, 16) === "fmt "
    && buffer.readUInt32LE(16) === 16 && buffer.readUInt16LE(20) === 1 && buffer.readUInt16LE(22) === 1
    && buffer.readUInt32LE(24) === 16000 && buffer.readUInt32LE(28) === 32000
    && buffer.readUInt16LE(32) === 2 && buffer.readUInt16LE(34) === 16
    && buffer.toString("ascii", 36, 40) === "data" && buffer.readUInt32LE(40) === buffer.length - 44
    && buffer.length > 44 && (buffer.length - 44) % 2 === 0;
}

export const uploadQuotationAudio: RequestHandler = (req, res, next) => {
  upload(req, res, (error) => {
    if (error) return next(new AppError("Không thể nhận âm thanh. Giới hạn một bản ghi 90 giây, tối đa 3 MB.", 400));
    if (!req.file || !validQuotationAudio(req.file.buffer)) return next(new AppError("Âm thanh chưa hợp lệ. Hãy ghi lại bằng nút micro trên form.", 400));
    next();
  });
};
