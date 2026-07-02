import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as reportService from "../services/report.service";
import { sendControllerError } from "../utils/controllerError";

export const createReport = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const report = await reportService.createReport(user.id, user.role, req.body);
    return res.status(201).json({
      success: true,
      data: report,
      message: "Đã gửi báo cáo. Quản trị viên sẽ kiểm tra trước khi xử lý vi phạm.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyReports = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await reportService.getMyReports(user.id, req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getReportForUser = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const report = await reportService.getReportForUser(
      user.id,
      req.params.id as string,
    );
    return res.json({ success: true, data: report, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminReports = async (req: Request, res: Response) => {
  try {
    const result = await reportService.getAdminReports(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminReportById = async (req: Request, res: Response) => {
  try {
    const report = await reportService.getAdminReportById(req.params.id as string);
    return res.json({ success: true, data: report, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const reviewReport = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const report = await reportService.reviewReport(
      user.id,
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: report,
      message: "Đã cập nhật trạng thái báo cáo.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
