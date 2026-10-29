import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as reportService from "../services/report.service";
import { sendControllerError } from "../utils/controllerError";
import { reverifyCustomerNoShowCalls } from "../services/customerNoShowReverification.service";

export const reverifyCustomerNoShow = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    await reverifyCustomerNoShowCalls(user.id, req.params.id as string);
    const report = await reportService.getAdminReportById(req.params.id as string);
    return res.json({ success: true, data: report, message: "Đã xác minh lại cuộc gọi và lưu lịch sử kiểm tra." });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

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

export const cancelReport = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const data = await reportService.cancelReport(user.id, req.params.id as string);
    return res.json({ success: true, data, message: "Đã hủy báo cáo." });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

export const addReportEvidence = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const data = await reportService.addReportEvidence(user.id, user.role, req.params.id as string, req.body);
    return res.json({ success: true, data, message: "Đã bổ sung bằng chứng." });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

export const requestReportEvidence = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const data = await reportService.requestReportEvidence(user.id, req.params.id as string, req.body.requestedEvidenceNote);
    return res.json({ success: true, data, message: "Đã yêu cầu bổ sung bằng chứng." });
  } catch (error: unknown) { return sendControllerError(res, error); }
};
