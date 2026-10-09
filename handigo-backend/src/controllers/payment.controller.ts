import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as paymentService from "../services/payment.service";
import { sendControllerError } from "../utils/controllerError";
import {
  orderIdParamSchema,
  paymentHistoryQuerySchema,
  paymentIdParamSchema,
} from "../validations/payment.validator";
import { retryPayosRefundByPaymentId } from "../services/orderCancellation.service";
import { getPayosPaymentQr } from "../services/payosQr.service";

export const getPaymentQr = async (req: Request, res: Response) => {
  try {
    const { id } = paymentIdParamSchema.parse(req.params);
    const image = await getPayosPaymentQr(id, requireRequestUser(req));
    res.setHeader("Cache-Control", "no-store");
    return res.type("png").send(image);
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await paymentService.createPayment(user, req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message: "Tạo thanh toán thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
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
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const params = paymentIdParamSchema.parse(req.params);
    const user = requireRequestUser(req);
    const payment = await paymentService.getPaymentById(params.id, user);

    return res.json({
      success: true,
      data: payment,
      message: "Lấy thông tin thanh toán thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getPaymentsByOrder = async (req: Request, res: Response) => {
  try {
    const params = orderIdParamSchema.parse(req.params);
    const user = requireRequestUser(req);
    const payments = await paymentService.getPaymentsByOrder(params.orderId, user);

    return res.json({
      success: true,
      data: payments,
      message: "Lấy thanh toán theo đơn hàng thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const reconcilePayosPaymentByOrder = async (req: Request, res: Response) => {
  try {
    const params = orderIdParamSchema.parse(req.params);
    const user = requireRequestUser(req);
    const result = await paymentService.reconcilePayosPaymentForOrder(
      params.orderId,
      user,
    );

    return res.json({
      success: true,
      data: result,
      message: "Đối soát thanh toán PayOS thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const query = paymentHistoryQuerySchema.parse(req.query);
    const user = requireRequestUser(req);
    const history = await paymentService.getPaymentHistory(user, query);

    return res.json({
      success: true,
      data: history,
      message: "Lấy lịch sử thanh toán thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const retryPayosRefund = async (req: Request, res: Response) => {
  try {
    const params = paymentIdParamSchema.parse(req.params);
    const refund = await retryPayosRefundByPaymentId(params.id);

    return res.json({
      success: true,
      data: refund,
      message: "Đã đưa yêu cầu hoàn tiền PayOS vào hàng đợi xử lý lại",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
