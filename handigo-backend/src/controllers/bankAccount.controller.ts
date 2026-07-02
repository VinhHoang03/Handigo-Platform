import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as bankAccountService from "../services/bankAccount.service";
import { sendControllerError } from "../utils/controllerError";
import { bankAccountIdParamSchema } from "../validations/bankAccount.validator";

export const listMyBankAccounts = async (req: Request, res: Response) => {
  try {
    const result = await bankAccountService.listMyBankAccounts(requireRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách tài khoản ngân hàng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const createMyBankAccount = async (req: Request, res: Response) => {
  try {
    const result = await bankAccountService.createMyBankAccount(
      requireRequestUser(req),
      req.body,
    );

    return res.status(201).json({
      success: true,
      data: result,
      message: "Thêm tài khoản ngân hàng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.updateMyBankAccount(
      requireRequestUser(req),
      params.id,
      req.body,
    );

    return res.json({
      success: true,
      data: result,
      message: "Cập nhật tài khoản ngân hàng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const setDefaultMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.setDefaultMyBankAccount(
      requireRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: result,
      message: "Đặt tài khoản ngân hàng mặc định thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const deleteMyBankAccount = async (req: Request, res: Response) => {
  try {
    const params = bankAccountIdParamSchema.parse(req.params);
    const result = await bankAccountService.deleteMyBankAccount(
      requireRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: result,
      message: "Xóa tài khoản ngân hàng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
