import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as supportTicketService from "../services/supportTicket.service";
import { sendControllerError } from "../utils/controllerError";

export const createSupportTicket = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.createSupportTicket(
      user.id,
      user.role,
      req.body,
    );
    return res.status(201).json({
      success: true,
      data: ticket,
      message: "Đã tạo yêu cầu hỗ trợ.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMySupportTickets = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await supportTicketService.getMySupportTickets(
      user.id,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getSupportTicketForUser = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.getSupportTicketForUser(
      user.id,
      req.params.id as string,
    );
    return res.json({ success: true, data: ticket, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const addSupportTicketResponse = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.addSupportTicketResponse(
      user.id,
      user.role,
      req.params.id as string,
      req.body,
    );
    return res.status(201).json({
      success: true,
      data: ticket,
      message: "Đã gửi phản hồi.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const cancelSupportTicket = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.cancelSupportTicket(
      user.id,
      req.params.id as string,
    );
    return res.json({
      success: true,
      data: ticket,
      message: "Đã hủy yêu cầu hỗ trợ.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminSupportTickets = async (req: Request, res: Response) => {
  try {
    const result = await supportTicketService.getAdminSupportTickets(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getAdminSupportTicketById = async (
  req: Request,
  res: Response,
) => {
  try {
    const ticket = await supportTicketService.getAdminSupportTicketById(
      req.params.id as string,
    );
    return res.json({ success: true, data: ticket, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateSupportTicketStatus = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.updateSupportTicketStatus(
      user.id,
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: ticket,
      message: "Đã cập nhật yêu cầu hỗ trợ.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const assignSupportTicket = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const ticket = await supportTicketService.assignSupportTicket(
      user.id,
      req.params.id as string,
      req.body.assignedAdminId,
    );
    return res.json({
      success: true,
      data: ticket,
      message: "Đã phân công yêu cầu hỗ trợ.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
