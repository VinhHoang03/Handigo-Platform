import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as voucherService from "../services/voucher.service";
import { sendControllerError } from "../utils/controllerError";
import {
  adminVoucherQuerySchema,
  availableVoucherQuerySchema,
  voucherIdParamSchema,
} from "../validations/voucher.validator";

export const applyVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await voucherService.applyVoucher(user, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Áp dụng voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const removeVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await voucherService.removeVoucher(user, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Gỡ voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAvailableVouchers = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const query = availableVoucherQuerySchema.parse(req.query);
    const result = await voucherService.getAvailableVouchers(user, query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách voucher khả dụng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const createAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await voucherService.createAdminVoucher(user, req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tạo voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminVouchers = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const query = adminVoucherQuerySchema.parse(req.query);
    const result = await voucherService.getAdminVouchers(user, query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminVoucherById = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.getAdminVoucherById(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Lấy thông tin voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.updateAdminVoucher(user, params.id, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Cập nhật voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const disableAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.disableAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Vô hiệu hóa voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const enableAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.enableAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Kích hoạt voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const deleteAdminVoucher = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = voucherIdParamSchema.parse(req.params);
    const result = await voucherService.deleteAdminVoucher(user, params.id);

    return res.json({
      success: true,
      data: result,
      message: "Xóa voucher thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
