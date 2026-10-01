import type { Request, Response, NextFunction } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { assistQuotation, suggestQuotationHistory, transcribeQuotation } from "../services/quotationAgent.service";
import { AppError } from "../utils/appError";

function requestSignal(res: Response) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  res.once("close", abort);
  return { signal: controller.signal, dispose: () => res.off("close", abort) };
}

export async function quotationAgentAssist(req: Request, res: Response, next: NextFunction) {
  const pending = requestSignal(res);
  try {
    const data = await assistQuotation(String(req.params.orderId), requireRequestUser(req).id, req.body, pending.signal);
    res.json({ success: true, data });
  } catch (error) { next(error); } finally { pending.dispose(); }
}

export async function quotationAgentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await suggestQuotationHistory(String(req.params.orderId), requireRequestUser(req).id, String(req.query.query));
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

export async function quotationAgentTranscribe(req: Request, res: Response, next: NextFunction) {
  const pending = requestSignal(res);
  try {
    if (!req.file) throw new AppError("Vui lòng ghi âm nội dung báo giá.", 400);
    const data = await transcribeQuotation(String(req.params.orderId), requireRequestUser(req).id, req.file.buffer, pending.signal);
    res.json({ success: true, data });
  } catch (error) { next(error); } finally { pending.dispose(); }
}
