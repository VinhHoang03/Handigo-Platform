import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as providerApplicationService from "../services/providerApplication.service";
import { sendControllerError } from "../utils/controllerError";

const getUserId = (req: Request) => requireAuthenticatedUser(req).id;

export const createApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.createApplication(
      getUserId(req),
      req.body,
    );

    return res.status(201).json({
      success: true,
      data: application,
      message: "Provider application created successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.getMyApplication(
      getUserId(req),
    );

    return res.json({
      success: true,
      data: application,
      message: "Success",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyApplications = async (req: Request, res: Response) => {
  try {
    const result = await providerApplicationService.getMyApplications(
      getUserId(req),
      req.query,
    );
    return res.json({ success: true, data: result, message: "Thành công" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyApplicationById = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.getMyApplicationById(
      getUserId(req),
      req.params.id as string,
    );
    return res.json({ success: true, data: application, message: "Thành công" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const resubmitApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.resubmitApplication(
      getUserId(req),
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      data: application,
      message: "Gửi lại hồ sơ thành công",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const saveDraftApplication = async (req: Request, res: Response) => {
  try {
    const application = await providerApplicationService.saveDraftApplication(
      getUserId(req),
      req.body,
    );

    return res.json({
      success: true,
      data: application,
      message: "Provider application draft saved successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
