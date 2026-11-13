import type { Request, Response, NextFunction } from "express";
import { requireAuthenticatedUser } from "../../middlewares/authContext";
import { listConfigs, changeConfig, enqueueAssessment, listSources } from "./admin-ai.service";
import { AdminAIAssessment, AdminAIConfigHistory } from "./admin-ai.models";
import type { AdminAIFeature } from "./admin-ai.validation";
import { AppError } from "../../utils/appError";
import type { QueryFilter } from "mongoose";
import { classificationContext, correctClassification } from "./admin-ai.classification";
import { decideComplaint } from "./admin-ai.complaint-decision";

export const configs = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await listConfigs() }); } catch (error) { next(error); }
};
export const complaintDecision = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await decideComplaint(String(req.params.id), requireAuthenticatedUser(req).id, req.body) }); } catch (error) { next(error); }
};
export const saveConfig = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await changeConfig(req.params.feature as AdminAIFeature, requireAuthenticatedUser(req).id, req.body.revision, { draft: req.body.draft }) }); } catch (error) { next(error); }
};
export const activate = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await changeConfig(req.params.feature as AdminAIFeature, requireAuthenticatedUser(req).id, req.body.revision, { enabled: req.body.enabled }) }); } catch (error) { next(error); }
};
export const run = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(202).json({ success: true, data: await enqueueAssessment(req.body, requireAuthenticatedUser(req).id) }); } catch (error) { next(error); }
};
export const assessments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
    const filter: QueryFilter<InstanceType<typeof AdminAIAssessment>> = { ...(req.query.feature ? { feature: req.query.feature as AdminAIFeature } : {}), ...(req.query.status ? { status: req.query.status as "queued" } : {}), ...(req.query.sourceId ? { sourceId: String(req.query.sourceId) } : {}) };
    const [items, total] = await Promise.all([AdminAIAssessment.find(filter).select("-policy -key -leaseToken -sourceHash").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AdminAIAssessment.countDocuments(filter)]);
    res.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};
export const assessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await AdminAIAssessment.findById(req.params.id).select("-key -leaseToken -sourceHash").lean();
    if (!item) throw new AppError("Không tìm thấy kết quả AI.", 404);
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
};
export const history = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await AdminAIConfigHistory.find({ feature: req.params.feature as AdminAIFeature }).sort({ revision: -1 }).limit(30).lean() }); } catch (error) { next(error); }
};
export const sources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await listSources(String(req.query.type), req.query.email as string | undefined) });
  } catch (error) { next(error); }
};
export const classification = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await classificationContext(String(req.params.id)) }); } catch (error) { next(error); }
};
export const correct = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await correctClassification(String(req.params.id), requireAuthenticatedUser(req).id, req.body) }); } catch (error) { next(error); }
};
