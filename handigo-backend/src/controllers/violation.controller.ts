import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as violationService from "../services/violation.service";
import { sendControllerError } from "../utils/controllerError";

export const createViolation = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const violation = await violationService.createViolation(user.id, req.body);
    return res.status(201).json({
      success: true,
      data: violation,
      message: "Đã tạo bản ghi vi phạm và áp dụng hình phạt.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminViolations = async (req: Request, res: Response) => {
  try {
    const result = await violationService.getAdminViolations(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminViolationById = async (req: Request, res: Response) => {
  try {
    const violation = await violationService.getAdminViolationById(
      req.params.id as string,
    );
    return res.json({ success: true, data: violation, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyViolations = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await violationService.getMyViolations(user.id, req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
