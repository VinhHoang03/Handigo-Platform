import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as adminService from "../services/admin.service";
import { sendControllerError } from "../utils/controllerError";

const getUserId = (req: Request) => requireAuthenticatedUser(req).id;

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getUsers(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await adminService.getUserById(req.params.id as string);
    return res.json({ success: true, data: user, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const user = await adminService.updateUserStatus(
      getUserId(req),
      req.params.id as string,
      req.body.status,
    );
    return res.json({
      success: true,
      data: user,
      message: "User status updated successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getProviderApplications = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getProviderApplications(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getProviderApplicationById = async (
  req: Request,
  res: Response,
) => {
  try {
    const application = await adminService.getProviderApplicationById(
      req.params.id as string,
    );
    return res.json({ success: true, data: application, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const reviewProviderApplication = async (
  req: Request,
  res: Response,
) => {
  try {
    const application = await adminService.reviewProviderApplication(
      getUserId(req),
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: application,
      message: "Provider application reviewed successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getFeedbacks = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getFeedbacks(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
