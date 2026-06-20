import { Request, Response } from "express";
import * as providerApplicationService from "../services/providerApplication.service";

const getStatusCode = (error: any) => error.statusCode || 500;

export const createApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.createApplication(
      req.user!.id,
      req.body,
    );

    return res.status(201).json({
      success: true,
      data: application,
      message: "Provider application created successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.getMyApplication(req.user!.id);

    return res.json({
      success: true,
      data: application,
      message: "Success",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyApplications = async (req: Request, res: Response) => {
  try {
    const result = await providerApplicationService.getMyApplications(
      req.user!.id,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Thành công" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyApplicationById = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.getMyApplicationById(
      req.user!.id,
      req.params.id as string,
    );
    return res.json({ success: true, data: application, message: "Thành công" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const resubmitApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.resubmitApplication(
      req.user!.id,
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: application,
      message: "Gửi lại hồ sơ thành công",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const saveDraftApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.saveDraftApplication(
      req.user!.id,
      req.body,
    );

    return res.json({
      success: true,
      data: application,
      message: "Provider application draft saved successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};
