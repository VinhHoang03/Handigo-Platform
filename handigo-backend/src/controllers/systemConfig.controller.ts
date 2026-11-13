import { NextFunction, Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as systemConfigService from "../services/systemConfig.service";
import { DispatchService } from "../services/dispatch.service";
import { Order } from "../models/order.model";
import { AppError } from "../utils/appError";
import { randomUUID } from "node:crypto";
import {
  createSystemConfigSchema,
  systemConfigKeyParamSchema,
  systemConfigListQuerySchema,
  updateSystemConfigSchema,
} from "../validations/systemConfig.validator";

type ScanRows = Awaited<ReturnType<typeof DispatchService.previewOrderScan>>;
const scanPreviews = new Map<string, { token: string; expiresAt: number; rows: ScanRows }>();

export const previewOrderScan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireRequestUser(req);
    const scannedAt = new Date();
    const rows = await DispatchService.previewOrderScan(scannedAt);
    const token = randomUUID();
    const now = Date.now();
    for (const [id, preview] of scanPreviews) if (preview.expiresAt <= now) scanPreviews.delete(id);
    if (rows.length) scanPreviews.set(admin.id, { token, expiresAt: now + 15 * 60_000, rows });
    else scanPreviews.delete(admin.id);
    return res.set("Cache-Control", "no-store").json({ success: true, data: { token, scannedAt, rows } });
  } catch (error) {
    return next(error);
  }
};

export const scanOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireRequestUser(req);
    const preview = scanPreviews.get(admin.id);
    if (!preview || preview.token !== req.body?.token || preview.expiresAt <= Date.now()) {
      throw new AppError("Báo cáo đã hết hiệu lực. Vui lòng quét lại.", 409);
    }
    scanPreviews.delete(admin.id);
    const current = await Order.find({ _id: { $in: preview.rows.map(row => row.id) }, isDeleted: false })
      .select("updatedAt").lean();
    const versions = new Map(current.map(order => [String(order._id), order.updatedAt.getTime()]));
    const ids = preview.rows.filter(row => versions.get(row.id) === row.updatedAt.getTime()).map(row => row.id);
    const result = ids.length ? await DispatchService.scanOrders(ids) : { failed: 0 };
    const data = { ...result, skipped: preview.rows.length - ids.length };
    return res.json({ success: true, message: "Đã quét và xử lý các đơn đến hạn.", data });
  } catch (error) {
    return next(error);
  }
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
    const data = await systemConfigService.getAllConfigs(requireRequestUser(req), query);

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
    const data = await systemConfigService.getConfigByKey(requireRequestUser(req), params.key);

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
    const data = await systemConfigService.createConfig(requireRequestUser(req), body);

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
    const data = await systemConfigService.updateConfig(
      requireRequestUser(req),
      params.key,
      body,
    );

    return res.json({
      success: true,
      message: "Cập nhật cấu hình hệ thống thành công",
      data,
    });
  } catch (error) {
    return next(error);
  }
};
