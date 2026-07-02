import { NextFunction, Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as dashboardService from "../services/dashboard.service";
import { AppError } from "../utils/appError";
import {
  dashboardQuerySchema,
  providerAvailabilitySchema,
} from "../validations/dashboard.validator";

export const getAdminOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getAdminOverview(query);

    return res.json({ success: true, data, message: "Get admin dashboard overview successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getDashboardOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = requireRequestUser(req);
    const query = dashboardQuerySchema.parse(req.query);

    if (user.role === "ADMIN") {
      const data = await dashboardService.getAdminOverview(query);
      return res.json({ success: true, data, message: "Get admin dashboard overview successfully" });
    }

    if (user.role === "PROVIDER") {
      const data = await dashboardService.getProviderOverview(user, query);
      return res.json({ success: true, data, message: "Get provider dashboard overview successfully" });
    }

    throw new AppError("Access denied: insufficient permissions", 403);
  } catch (error) {
    return next(error);
  }
};

export const getAdminRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getAdminRevenue(query);

    return res.json({ success: true, data, message: "Get admin revenue dashboard successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getAdminOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getAdminOrders(query);

    return res.json({ success: true, data, message: "Get admin order dashboard successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getAdminProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getAdminProviders(query);

    return res.json({ success: true, data, message: "Get admin provider dashboard successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getProviderOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getProviderOverview(requireRequestUser(req), query);

    return res.json({ success: true, data, message: "Get provider dashboard overview successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getProviderEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getProviderEarnings(requireRequestUser(req), query);

    return res.json({ success: true, data, message: "Get provider earning dashboard successfully" });
  } catch (error) {
    return next(error);
  }
};

export const updateProviderAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = providerAvailabilitySchema.parse(req.body);
    const data = await dashboardService.updateProviderAvailability(
      requireRequestUser(req),
      payload.availabilityStatus,
    );

    return res.json({ success: true, data, message: "Provider availability updated successfully" });
  } catch (error) {
    return next(error);
  }
};
