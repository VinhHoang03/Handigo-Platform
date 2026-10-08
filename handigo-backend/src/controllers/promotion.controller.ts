import { Request, Response, NextFunction } from "express";
import * as promotions from "../services/promotion.service";

export const active = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await promotions.listActivePromotions() }); } catch (error) { next(error); }
};
export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await promotions.listAdminPromotions() }); } catch (error) { next(error); }
};
export const save = async (req: Request, res: Response, next: NextFunction) => {
  try { const data = await promotions.savePromotion(req.body, req.params.id as string | undefined); res.status(req.params.id ? 200 : 201).json({ success: true, data }); } catch (error) { next(error); }
};
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try { await promotions.deletePromotion(req.params.id as string); res.json({ success: true, data: null, message: "Đã xóa chương trình khuyến mãi." }); } catch (error) { next(error); }
};
