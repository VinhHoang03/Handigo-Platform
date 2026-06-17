import { Request, Response } from "express";
import { ZodError } from "zod";
import * as walletService from "../services/wallet.service";
import { AppError } from "../utils/appError";
import {
  adminWalletListQuerySchema,
  providerIdParamSchema,
  walletTransactionQuerySchema,
} from "../validations/wallet.validator";

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
    code: error.code,
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

export const getMyWallet = async (req: Request, res: Response) => {
  try {
    const result = await walletService.getCurrentWallet(getRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy thông tin ví thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getMyWalletTransactions = async (req: Request, res: Response) => {
  try {
    const query = walletTransactionQuerySchema.parse(req.query);
    const result = await walletService.getWalletTransactionHistory(
      getRequestUser(req),
      query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Lấy lịch sử giao dịch ví thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getMyWalletSummary = async (req: Request, res: Response) => {
  try {
    const result = await walletService.getWalletSummary(getRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy tổng quan ví thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const createMyWalletDeposit = async (req: Request, res: Response) => {
  try {
    const result = await walletService.createWalletDeposit(getRequestUser(req), req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tao lien ket nap vi thanh cong",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAdminWallets = async (req: Request, res: Response) => {
  try {
    const query = adminWalletListQuerySchema.parse(req.query);
    const result = await walletService.getAdminWallets(query);

    return res.json({
      success: true,
      data: result,
      message: "Lấy danh sách ví thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAdminWalletByProviderId = async (req: Request, res: Response) => {
  try {
    const params = providerIdParamSchema.parse(req.params);
    const result = await walletService.getAdminWalletByProviderId(params.providerId);

    return res.json({
      success: true,
      data: result,
      message: "Lấy thông tin ví nhà cung cấp thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getAdminWalletTransactions = async (req: Request, res: Response) => {
  try {
    const params = providerIdParamSchema.parse(req.params);
    const query = walletTransactionQuerySchema.parse(req.query);
    const result = await walletService.getAdminWalletTransactions(
      params.providerId,
      query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Lấy lịch sử giao dịch ví nhà cung cấp thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const adjustAdminWallet = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const params = providerIdParamSchema.parse(req.params);
    const result = await walletService.adjustWallet(params.providerId, user.id, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Điều chỉnh ví thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};
