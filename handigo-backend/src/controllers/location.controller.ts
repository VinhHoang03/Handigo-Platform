import type { NextFunction, Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as locationService from "../services/location.service";
import { reverseGeocode, suggestAddresses } from "../services/reverseGeocoding.service";
import { suggestAddressMapLocation } from "../services/agentAddressResolver.service";
import type {
  AddressSuggestQuery,
  ReverseGeocodeQuery,
} from "../validations/location.validator";

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

export const deactivateCurrentLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await locationService.deactivateCurrentLocation(requireAuthenticatedUser(req).id);
    return res.json({ success: true, data: null, message: "Đã tắt chia sẻ vị trí hiện tại" });
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

export const suggestAddressLines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, province, ward } = req.query as unknown as AddressSuggestQuery;
    const data = await suggestAddresses(q, { province, ward });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
};

export const geocodeAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await suggestAddressMapLocation(req.body);
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
};
