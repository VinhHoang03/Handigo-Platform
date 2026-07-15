import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as complaintService from "../services/complaint.service";
import { sendControllerError } from "../utils/controllerError";

export const createComplaint = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.createComplaint(
      user.id,
      user.role,
      req.body,
    );
    return res.status(201).json({
      success: true,
      data: complaint,
      message: "Đã tạo khiếu nại. Quản trị viên sẽ xem xét và phản hồi.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyComplaints = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await complaintService.getMyComplaints(user.id, req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getComplaintForUser = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.getComplaintForUser(
      user.id,
      req.params.id as string,
    );
    return res.json({ success: true, data: complaint, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const cancelComplaint = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.cancelComplaint(
      user.id,
      req.params.id as string,
    );
    return res.json({ success: true, data: complaint, message: "Đã hủy khiếu nại." });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const addComplaintEvidence = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.addComplaintEvidence(
      user.id,
      user.role,
      req.params.id as string,
      req.body,
    );
    return res.status(201).json({
      success: true,
      data: complaint,
      message: "Đã bổ sung bằng chứng cho khiếu nại.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminComplaints = async (req: Request, res: Response) => {
  try {
    const result = await complaintService.getAdminComplaints(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminComplaintById = async (req: Request, res: Response) => {
  try {
    const complaint = await complaintService.getAdminComplaintById(
      req.params.id as string,
    );
    return res.json({ success: true, data: complaint, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const requestEvidence = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.requestEvidence(
      user.id,
      req.params.id as string,
      req.body.requestedEvidenceNote,
    );
    return res.json({
      success: true,
      data: complaint,
      message: "Đã yêu cầu bổ sung bằng chứng.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateComplaintStatus = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const complaint = await complaintService.updateComplaintStatus(
      user.id,
      req.params.id as string,
      req.body,
    );
    return res.json({ success: true, data: complaint, message: "Đã cập nhật khiếu nại." });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
