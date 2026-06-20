import { NextFunction, Request, Response } from "express";
import * as systemConfigService from "../services/systemConfig.service";
import { AppError } from "../utils/appError";
import {
  createSystemConfigSchema,
  systemConfigKeyParamSchema,
  systemConfigListQuerySchema,
  updateSystemConfigSchema,
} from "../validations/systemConfig.validator";

const getRequestUser = (req: Request) => {
  if (!req.user) {
    throw new AppError("Vui lòng đăng nhập để tiếp tục", 401);
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
};

export const getPublicConfigs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemConfigService.getPublicConfigs();

    return res.json({
      success: true,
      message: "Lấy cấu hình hệ thống công khai thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllConfigs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = systemConfigListQuerySchema.parse(req.query);
    const data = await systemConfigService.getAllConfigs(getRequestUser(req), query);

    return res.json({
      success: true,
      message: "Lấy danh sách cấu hình hệ thống thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const getConfigByKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = systemConfigKeyParamSchema.parse(req.params);
    const data = await systemConfigService.getConfigByKey(getRequestUser(req), params.key);

    return res.json({
      success: true,
      message: "Lấy cấu hình hệ thống thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const createConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSystemConfigSchema.parse(req.body);
    const data = await systemConfigService.createConfig(getRequestUser(req), body);

    return res.status(201).json({
      success: true,
      message: "Tạo cấu hình hệ thống thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = systemConfigKeyParamSchema.parse(req.params);
    const body = updateSystemConfigSchema.parse(req.body);
    const data = await systemConfigService.updateConfig(getRequestUser(req), params.key, body);

    return res.json({
      success: true,
      message: "Cập nhật cấu hình hệ thống thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};
