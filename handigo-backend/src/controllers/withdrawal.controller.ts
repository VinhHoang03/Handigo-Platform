import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as withdrawalService from "../services/withdrawal.service";
import { sendControllerError } from "../utils/controllerError";
import {
  withdrawalIdParamSchema,
  withdrawalListQuerySchema,
  withdrawalReviewSchema,
} from "../validations/withdrawal.validator";

export const createWithdrawal = async (req: Request, res: Response) => {
  try {
    const withdrawal = await withdrawalService.createWithdrawal(requireRequestUser(req), req.body);

    return res.status(201).json({
      success: true,
      data: withdrawal,
      message: "Tạo yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyWithdrawals = async (req: Request, res: Response) => {
  try {
    const query = withdrawalListQuerySchema.parse(req.query);
    const result = await withdrawalService.getMyWithdrawals(requireRequestUser(req), query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyWithdrawalById = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const withdrawal = await withdrawalService.getMyWithdrawalById(
      requireRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: withdrawal,
      message: "Lấy chi tiết yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminWithdrawals = async (req: Request, res: Response) => {
  try {
    const query = withdrawalListQuerySchema.parse(req.query);
    const result = await withdrawalService.getAdminWithdrawals(query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminWithdrawalById = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const withdrawal = await withdrawalService.getAdminWithdrawalById(params.id);

    return res.json({
      success: true,
      data: withdrawal,
      message: "Lấy chi tiết yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const approveWithdrawal = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const body = withdrawalReviewSchema.parse(req.body);
    const withdrawal = await withdrawalService.approveWithdrawal(
      requireRequestUser(req),
      params.id,
      body,
    );

    return res.json({
      success: true,
      data: withdrawal,
      message: "Duyệt yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const rejectWithdrawal = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const body = withdrawalReviewSchema.parse(req.body);
    const withdrawal = await withdrawalService.rejectWithdrawal(
      requireRequestUser(req),
      params.id,
      body,
    );

    return res.json({
      success: true,
      data: withdrawal,
      message: "Từ chối yêu cầu rút tiền thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
