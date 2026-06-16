import { Request, Response } from "express";
import { ZodError } from "zod";
import * as voucherService from "../services/voucher.service";
import { AppError } from "../utils/appError";
import { availableVoucherQuerySchema } from "../validations/voucher.validation";
import {
  adminVoucherQuerySchema,
  voucherIdParamSchema,
} from "../validations/voucher.validation";

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

export const applyVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const result = await voucherService.applyVoucher(user, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Áp dụng voucher thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const removeVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const result = await voucherService.removeVoucher(user, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Gỡ voucher thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAvailableVouchers = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const query = availableVoucherQuerySchema.parse(req.query);
    const result = await voucherService.getAvailableVouchers(user, query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách voucher khả dụng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const createAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const result = await voucherService.createAdminVoucher(user, req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tao voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAdminVouchers = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const query = adminVoucherQuerySchema.parse(req.query);
    const result = await voucherService.getAdminVouchers(user, query);

    return res.json({
      success: true,
      data: result,
      message: "Lay danh sach voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAdminVoucherById = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.getAdminVoucherById(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Lay thong tin voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const updateAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.updateAdminVoucher(user, params.id, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Cap nhat voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const disableAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.disableAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Vo hieu hoa voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const enableAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.enableAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Kich hoat voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const deleteAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.deleteAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Xoa voucher thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};
