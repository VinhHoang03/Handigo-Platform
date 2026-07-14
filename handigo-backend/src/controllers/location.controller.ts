import type { NextFunction, Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as locationService from "../services/location.service";
import { reverseGeocode } from "../services/reverseGeocoding.service";
import type { ReverseGeocodeQuery } from "../validations/location.validator";

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

export const reverseGeocodeCurrentLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await reverseGeocode(
      req.query as unknown as ReverseGeocodeQuery,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
