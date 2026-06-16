import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";
import * as withdrawalService from "../services/withdrawal.service";
import {
  withdrawalIdParamSchema,
  withdrawalListQuerySchema,
  withdrawalReviewSchema,
} from "../validations/withdrawal.validation";

const handleError = (res: Response, error: any) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: error.issues,
    });
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Có lỗi xảy ra",
  });
};

const getRequestUser = (req: Request) => {
  if (!req.user) {
    throw new AppError("Bạn cần đăng nhập để thực hiện thao tác này", 401);
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
};

export const createWithdrawal = async (req: Request, res: Response) => {
  try {
    const withdrawal = await withdrawalService.createWithdrawal(getRequestUser(req), req.body);

    return res.status(201).json({
      success: true,
      data: withdrawal,
      message: "Tạo yêu cầu rút tiền thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getMyWithdrawals = async (req: Request, res: Response) => {
  try {
    const query = withdrawalListQuerySchema.parse(req.query);
    const result = await withdrawalService.getMyWithdrawals(getRequestUser(req), query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách yêu cầu rút tiền thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getMyWithdrawalById = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const withdrawal = await withdrawalService.getMyWithdrawalById(getRequestUser(req), params.id);

    return res.json({
      success: true,
      data: withdrawal,
      message: "Lấy chi tiết yêu cầu rút tiền thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
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
  } catch (error: any) {
    return handleError(res, error);
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
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const approveWithdrawal = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const body = withdrawalReviewSchema.parse(req.body);
    const withdrawal = await withdrawalService.approveWithdrawal(
      getRequestUser(req),
      params.id,
      body,
    );

    return res.json({
      success: true,
      data: withdrawal,
      message: "Duyệt yêu cầu rút tiền thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const rejectWithdrawal = async (req: Request, res: Response) => {
  try {
    const params = withdrawalIdParamSchema.parse(req.params);
    const body = withdrawalReviewSchema.parse(req.body);
    const withdrawal = await withdrawalService.rejectWithdrawal(
      getRequestUser(req),
      params.id,
      body,
    );

    return res.json({
      success: true,
      data: withdrawal,
      message: "Từ chối yêu cầu rút tiền thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};
