import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { sendControllerError } from "../utils/controllerError";
import * as rewards from "../services/reward.service";
import { rewardPageSchema } from "../validations/reward.validator";

export const getOverview = async (req: Request, res: Response) => {
  try { return res.json({ success: true, data: await rewards.getRewardOverview(requireRequestUser(req).id) }); }
  catch (error) { return sendControllerError(res, error); }
};
export const getHistory = async (req: Request, res: Response) => {
  try {
    const { page } = rewardPageSchema.parse(req.query);
    return res.json({ success: true, data: await rewards.getRewardHistory(requireRequestUser(req).id, page) });
  } catch (error) { return sendControllerError(res, error); }
};
export const getMyVouchers = async (req: Request, res: Response) => {
  try {
    const { page } = rewardPageSchema.parse(req.query);
    return res.json({ success: true, data: await rewards.getMyRewardVouchers(requireRequestUser(req).id, page) });
  } catch (error) { return sendControllerError(res, error); }
};
export const redeem = async (req: Request, res: Response) => {
  try {
    const data = await rewards.redeemReward(requireRequestUser(req).id, req.body.offerId, req.body.requestId);
    return res.json({ success: true, data, message: "Đổi mã giảm giá thành công." });
  } catch (error) { return sendControllerError(res, error); }
};
