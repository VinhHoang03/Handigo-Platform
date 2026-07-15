import { NextFunction, Request, Response } from "express";
import { extractText } from "../services/ocr.service";

export const extract = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải lên tệp cần nhận diện",
      });
    }

    const result = await extractText(req.file.buffer, req.file.mimetype);
    return res.json({ success: true, text: result.text });
  } catch (error: any) {
    if (error.statusCode === 400) return next(error);

    const serviceError = new Error("Không thể nhận diện nội dung tệp bằng OCR");
    Object.assign(serviceError, { statusCode: 502 });
    next(serviceError);
  }
};
