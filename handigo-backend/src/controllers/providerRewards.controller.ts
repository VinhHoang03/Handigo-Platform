import type { NextFunction, Request, Response } from "express";
import { getProviderRewardOverview, listProviderRewardWeeks } from "../services/providerRewards.service";
import { AppError } from "../utils/appError";

function readDateQuery(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("Tuần thưởng không hợp lệ.", 400);
  }
  return value;
}

export async function getMyProviderRewardWeek(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getProviderRewardOverview(req.user!.id, readDateQuery(req.query.weekStart));
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

export async function getMyProviderRewardHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listProviderRewardWeeks(req.user!.id, readDateQuery(req.query.before));
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
