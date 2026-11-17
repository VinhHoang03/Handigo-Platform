import { Location } from "../models/location.model";
import User from "../models/user.model";
import { AppError } from "../utils/appError";
import type { CurrentLocationPayload } from "../validations/location.validator";
import { publishProviderLocationChanged } from "../sockets/socketServer";
import { createLogger } from "../utils/logger";

const logger = createLogger("Location");

export const getCurrentLocation = async (userId: string) => {
  return Location.findOne({ userId, isActive: true, isDeleted: false })
    .sort({ lastUpdatedAt: -1 })
    .lean();
};

export const updateCurrentLocation = async (
  userId: string,
  payload: CurrentLocationPayload,
) => {
  const user = await User.findById(userId).select("role isDeleted").lean();
  if (!user || user.isDeleted) {
    throw new AppError("Không tìm thấy tài khoản", 404);
  }

  const ownerType = user.role === "PROVIDER" ? "provider" : "customer";
  const location = await Location.findOneAndUpdate(
    { userId, ownerType, isDeleted: false },
    {
      coordinates: {
        type: "Point",
        coordinates: [payload.longitude, payload.latitude],
      },
      isActive: true,
      lastUpdatedAt: new Date(),
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();
  if (ownerType === "provider") {
    try { await publishProviderLocationChanged(userId); }
    catch (error) { logger.error("Đã lưu vị trí nhưng chưa phát được cập nhật trực tiếp.", error); }
  }
  return location;
};

export const deactivateCurrentLocation = async (userId: string) => {
  await Location.updateMany(
    { userId, ownerType: "provider", isDeleted: false },
    { $set: { isActive: false } },
    { runValidators: true },
  );
};
