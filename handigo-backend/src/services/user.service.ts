import User from "../models/user.model";

interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  avatar?: string;
}

export const getProfileService = async (userId: string) => {
  const user = await User.findById(userId).select("-passwordHash -registerOtp -registerOtpExpire -resetPasswordOtp -resetPasswordOtpExpire -resetPasswordTokenHash -resetPasswordExpire");
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

export const updateProfileService = async (
  userId: string,
  data: UpdateProfileInput
) => {

  const updateData: any = {};

  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    {
      new: true,
      runValidators: true,
    },
  ).select("-passwordHash -registerOtp -registerOtpExpire -resetPasswordOtp -resetPasswordOtpExpire -resetPasswordTokenHash -resetPasswordExpire");

  if (!user) {
    throw new Error("User not found");
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
    throw new Error("User not found");
  }
  return user;
};


export const updateUserService = async (userId: string, data: any) => {
  const user = await User.findByIdAndUpdate(userId, data, {
    new: true,
    runValidators: true,
  }).select("-passwordHash");
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

export const deleteUserService = async (userId: string) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};
