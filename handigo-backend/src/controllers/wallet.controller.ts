import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as walletService from "../services/wallet.service";
import { sendControllerError } from "../utils/controllerError";
import {
  adminWalletListQuerySchema,
  providerIdParamSchema,
  walletDepositOrderCodeParamSchema,
  walletTransactionQuerySchema,
} from "../validations/wallet.validator";

export const getMyWallet = async (req: Request, res: Response) => {
  try {
    const result = await walletService.getCurrentWallet(requireRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy thông tin ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const getMyWalletTransactions = async (req: Request, res: Response) => {
  try {
    const query = walletTransactionQuerySchema.parse(req.query);
    const result = await walletService.getWalletTransactionHistory(
      requireRequestUser(req),
      query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Lấy lịch sử giao dịch ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const getMyWalletSummary = async (req: Request, res: Response) => {
  try {
    const result = await walletService.getWalletSummary(requireRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Lấy tổng quan ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const createMyWalletDeposit = async (req: Request, res: Response) => {
  try {
    const result = await walletService.createWalletDeposit(requireRequestUser(req), req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tạo liên kết nạp ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const cancelMyWalletDeposit = async (req: Request, res: Response) => {
  try {
    const params = walletDepositOrderCodeParamSchema.parse(req.params);
    const result = await walletService.cancelWalletDeposit(
      requireRequestUser(req),
      params.orderCode,
    );

    return res.json({
      success: true,
      data: result,
      message: "Đã hủy giao dịch nạp ví",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const syncMyWalletDeposit = async (req: Request, res: Response) => {
  try {
    const params = walletDepositOrderCodeParamSchema.parse(req.params);
    const result = await walletService.syncWalletDeposit(
      requireRequestUser(req),
      params.orderCode,
    );

    return res.json({
      success: true,
      data: result,
      message: "Đồng bộ giao dịch nạp ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
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
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
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
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
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
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};

export const adjustAdminWallet = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const params = providerIdParamSchema.parse(req.params);
    const result = await walletService.adjustWallet(params.providerId, user.id, req.body);

    return res.json({
      success: true,
      data: result,
      message: "Điều chỉnh ví thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error, { includeCode: true });
  }
};
