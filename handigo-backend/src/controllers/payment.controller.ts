import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";
import * as paymentService from "../services/payment.service";
import {
  orderIdParamSchema,
  paymentHistoryQuerySchema,
  paymentIdParamSchema,
} from "../validations/payment.validation";

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

export const createPayment = async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const result = await paymentService.createPayment(user, req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tạo thanh toán thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const payosWebhook = async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.handlePayosWebhook(req.body);

    return res.json({
      success: true,
      data: payment,
      message: "Xử lý webhook PayOS thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const params = paymentIdParamSchema.parse(req.params);
    const user = getRequestUser(req);
    const payment = await paymentService.getPaymentById(params.id, user);

    return res.json({
      success: true,
      data: payment,
      message: "Lấy thông tin thanh toán thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getPaymentsByOrder = async (req: Request, res: Response) => {
  try {
    const params = orderIdParamSchema.parse(req.params);
    const user = getRequestUser(req);
    const payments = await paymentService.getPaymentsByOrder(params.orderId, user);

    return res.json({
      success: true,
      data: payments,
      message: "Lấy thanh toán theo đơn hàng thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const query = paymentHistoryQuerySchema.parse(req.query);
    const user = getRequestUser(req);
    const history = await paymentService.getPaymentHistory(user, query);

    return res.json({
      success: true,
      data: history,
      message: "Lấy lịch sử thanh toán thành công",
    });
  } catch (error: any) {
    return handleError(res, error);
  }
};
