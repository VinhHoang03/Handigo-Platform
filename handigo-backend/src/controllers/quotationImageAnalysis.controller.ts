import { NextFunction, Request, Response } from "express";
import { analyzeQuotationImage } from "../services/quotationImageAnalysis.service";

export const scanQuotationItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ảnh hạng mục cần quét",
      });
    }

    const items = await analyzeQuotationImage(file.buffer, file.mimetype);
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return next(error);
  }
};
