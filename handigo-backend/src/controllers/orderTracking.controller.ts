import type { NextFunction, Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { getOrderTrackingRoute as getTrackingRoute } from "../services/orderTracking.service";
import { AppError } from "../utils/appError";
import type { TrackingRouteQuery } from "../validations/order.validator";

const getParam = (req: Request, name: string) => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : String(value || "");
};

export const getOrderTrackingRoute = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = requireRequestUser(req);
    if (user.role !== "CUSTOMER" && user.role !== "PROVIDER") {
      throw new AppError(
        "Bạn không có quyền xem tuyến đường của đơn hàng này.",
        403,
      );
    }

    const data = await getTrackingRoute(
      getParam(req, "orderId"),
      user.id,
      user.role,
      req.query as unknown as TrackingRouteQuery,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
