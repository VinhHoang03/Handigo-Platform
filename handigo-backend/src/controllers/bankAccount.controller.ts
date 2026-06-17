import { Request, Response } from "express";
import { ZodError } from "zod";
import * as bankAccountService from "../services/bankAccount.service";
import { AppError } from "../utils/appError";
import { bankAccountIdParamSchema } from "../validations/bankAccount.validator";

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

export const listMyBankAccounts = async (req: Request, res: Response) => {
  try {
    const result = await bankAccountService.listMyBankAccounts(getRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách tài khoản ngân hàng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const createMyBankAccount = async (req: Request, res: Response) => {
  try {
    const result = await bankAccountService.createMyBankAccount(
      getRequestUser(req),
      req.body,
    );

    return res.status(201).json({
      success: true,
      data: result,
      message: "Thêm tài khoản ngân hàng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const updateMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.updateMyBankAccount(
      getRequestUser(req),
      params.id,
      req.body,
    );

    return res.json({
      success: true,
      data: result,
      message: "Cập nhật tài khoản ngân hàng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const setDefaultMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.setDefaultMyBankAccount(
      getRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: result,
      message: "Đặt tài khoản ngân hàng mặc định thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const deleteMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.deleteMyBankAccount(
      getRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: result,
      message: "Xóa tài khoản ngân hàng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};
