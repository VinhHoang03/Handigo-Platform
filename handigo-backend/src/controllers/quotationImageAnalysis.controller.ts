import { NextFunction, Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { analyzeQuotationImage } from "../services/quotationImageAnalysis.service";
import {
  evaluateQuotationItemsForOrder,
  evaluateQuotationItemsForProvider,
  getQuotationOrderForProvider,
} from "../services/quotationRelevance.service";
import { analyzeQuotationSpreadsheet } from "../services/quotationSpreadsheetAnalysis.service";

const SPREADSHEET_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
        message: "Vui lòng chọn ảnh hoặc tệp Excel chứa hạng mục",
      });
    }

    const order = await getQuotationOrderForProvider(
      String(req.body.orderId || ""),
      requireRequestUser(req).id,
    );
    const isSpreadsheet =
      file.mimetype === SPREADSHEET_MIME_TYPE ||
      file.originalname.toLowerCase().endsWith(".xlsx");
    const items =
      isSpreadsheet
        ? await analyzeQuotationSpreadsheet(file.buffer)
        : await analyzeQuotationImage(file.buffer, file.mimetype);
    const relevance = await evaluateQuotationItemsForOrder(order, items);
    return res.json({ success: true, data: { items, relevance } });
  } catch (error) {
    return next(error);
  }
};

export const validateQuotationItemsRelevance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = Array.isArray(req.params.orderId)
      ? req.params.orderId[0]
      : String(req.params.orderId || "");
    const relevance = await evaluateQuotationItemsForProvider(
      orderId,
      requireRequestUser(req).id,
      req.body.items,
    );
    return res.json({ success: true, data: { relevance } });
  } catch (error) {
    return next(error);
  }
};
