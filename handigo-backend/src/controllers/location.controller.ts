import type { NextFunction, Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as locationService from "../services/location.service";

export const getCurrentLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await locationService.getCurrentLocation(requireAuthenticatedUser(req).id);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const updateCurrentLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await locationService.updateCurrentLocation(
      requireAuthenticatedUser(req).id,
      req.body,
    );
    return res.json({
      success: true,
      data,
      message: "Đã cập nhật vị trí hiện tại",
    });
  } catch (error) {
    return next(error);
  }
};
