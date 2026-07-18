import { NextFunction, Request, Response } from "express";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";

export const approvedProviderMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "PROVIDER") {
      return res.status(403).json({
        message: "Chỉ Nhà cung cấp dịch vụ đã được duyệt mới có quyền truy cập",
      });
    }

    const [user, provider] = await Promise.all([
      User.findOne({ _id: userId, isDeleted: false }).select(
        "providerOnboardingStatus",
      ),
      Provider.exists({ userId, verified: true, isDeleted: false }),
    ]);

    if (
      !user ||
      (user.providerOnboardingStatus &&
        user.providerOnboardingStatus !== "APPROVED") ||
      !provider
    ) {
      return res.status(403).json({
        message: "Hồ sơ Nhà cung cấp dịch vụ chưa được phê duyệt",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
