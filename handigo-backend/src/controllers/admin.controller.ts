import { Request, Response } from "express";
import * as adminService from "../services/admin.service";

const getStatusCode = (error: any) => error.statusCode || 500;

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getUsers(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await adminService.getUserById(req.params.id as string);
    return res.json({ success: true, data: user, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const user = await adminService.updateUserStatus(
      req.user!.id,
      req.params.id as string,
      req.body.status,
    );
    return res.json({ success: true, data: user, message: "User status updated successfully" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getProviderApplications = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getProviderApplications(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getProviderApplicationById = async (req: Request, res: Response) => {
  try {
    const application = await adminService.getProviderApplicationById(req.params.id as string);
    return res.json({ success: true, data: application, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const reviewProviderApplication = async (req: Request, res: Response) => {
  try {
    const application = await adminService.reviewProviderApplication(
      req.user!.id,
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: application,
      message: "Provider application reviewed successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getFeedbacks = async (req: Request, res: Response) => {
  try {
    const result = await adminService.getFeedbacks(req.query);
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};
