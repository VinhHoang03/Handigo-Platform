import User from "../models/user.model";
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

export const getProfileService = async (userId: string) => {
  const user = await User.findById(userId).select("-passwordHash -registerOtp -registerOtpExpire -resetPasswordOtp -resetPasswordOtpExpire -resetPasswordTokenHash -resetPasswordExpire");
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }
  return user;
};

export const updateProfileService = async (
  userId: string,
  data: UpdateProfileInput
) => {
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
    user = await User.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).select("-passwordHash -registerOtp -registerOtpExpire -resetPasswordOtp -resetPasswordOtpExpire -resetPasswordTokenHash -resetPasswordExpire");
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

// CRUD Operations

export const getAllUsersService = async (query: any = {}) => {
  return await User.find(query).select("-passwordHash");
};

export const getUserByIdService = async (userId: string) => {
  const user = await User.findById(userId).select("-passwordHash");
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }
  return user;
};


export const updateUserService = async (userId: string, data: any) => {
  const user = await User.findByIdAndUpdate(userId, data, {
    new: true,
    runValidators: true,
  }).select("-passwordHash");
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }
  return user;
};

export const deleteUserService = async (userId: string) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }
  return user;
};
