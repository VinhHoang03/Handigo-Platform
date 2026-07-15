import { Types } from "mongoose";
import User from "../models/user.model";
import { Session } from "../models/session.model";
import { AppError } from "../utils/appError";
import {
  normalizePersonName,
  normalizeVietnamesePhone,
  getVietnamesePhoneLookupValues,
} from "../utils/profileValidation";

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  avatar?: string | null;
  birthday?: string | Date | null;
  gender?: "male" | "female" | "other" | null;
}

export const SAFE_USER_PROJECTION = [
  "-passwordHash",
  "-registerOtp",
  "-registerOtpExpire",
  "-resetPasswordOtp",
  "-resetPasswordOtpExpire",
  "-resetPasswordTokenHash",
  "-resetPasswordExpire",
  "-googleId",
  "-facebookId",
].join(" ");

const assertObjectId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("ID người dùng không hợp lệ", 400);
  }
};

const buildAdminUserFilter = (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = { isDeleted: false };

  if (
    typeof query.role === "string" &&
    ["CUSTOMER", "PROVIDER", "ADMIN"].includes(query.role)
  ) {
    filter.role = query.role;
  }

  if (
    typeof query.status === "string" &&
    ["active", "locked"].includes(query.status)
  ) {
    filter.status = query.status;
  }

  return filter;
};

export const getProfileService = async (userId: string) => {
  assertObjectId(userId);
  const user = await User.findOne({ _id: userId, isDeleted: false }).select(
    SAFE_USER_PROJECTION,
  );
  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }
  return user;
};

export const updateProfileService = async (
  userId: string,
  data: UpdateProfileInput
) => {
  assertObjectId(userId);
  const updateData: any = {};

  if (data.fullName !== undefined) {
    updateData.fullName = normalizePersonName(data.fullName);
  }
  if (data.phone !== undefined) {
    updateData.phone = normalizeVietnamesePhone(data.phone);
    const existingUser = await User.exists({
      _id: { $ne: userId },
      phone: { $in: getVietnamesePhoneLookupValues(updateData.phone) },
    });
    if (existingUser) {
      throw new AppError("Số điện thoại đã được sử dụng", 409);
    }
  }
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.birthday !== undefined) {
    updateData.birthday = data.birthday ? new Date(data.birthday) : null;
  }
  if (data.gender !== undefined) updateData.gender = data.gender;

  let user;
  try {
    user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).select(SAFE_USER_PROJECTION);
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      throw new AppError("Số điện thoại đã được sử dụng", 409);
    }
    throw error;
  }

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  return user;
};

// Các thao tác legacy được giữ để tương thích và chỉ được gọi từ route ADMIN.
export const getAllUsersService = async (
  query: Record<string, unknown> = {},
) => {
  return User.find(buildAdminUserFilter(query)).select(SAFE_USER_PROJECTION);
};

export const getUserByIdService = async (userId: string) => {
  assertObjectId(userId);
  const user = await User.findOne({ _id: userId, isDeleted: false }).select(
    SAFE_USER_PROJECTION,
  );
  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }
  return user;
};

export const updateUserService = async (
  userId: string,
  data: UpdateProfileInput,
) => {
  return updateProfileService(userId, data);
};

export const deleteUserService = async (userId: string, adminId: string) => {
  assertObjectId(userId);
  assertObjectId(adminId);

  if (userId === adminId) {
    throw new AppError("Quản trị viên không thể tự xóa tài khoản", 400);
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    {
      $set: {
        status: "locked",
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  ).select(SAFE_USER_PROJECTION);

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  return user;
};
