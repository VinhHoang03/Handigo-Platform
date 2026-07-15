import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import User from "../models/user.model";
import { Session } from "../models/session.model";
import * as providerApplicationService from "./providerApplication.service";
import { getAdminFeedbacks as listFeedbacks } from "./feedback.service";
import { SAFE_USER_PROJECTION } from "./user.service";

interface UserQuery {
  keyword?: string;
  role?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getPagination = (query: UserQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

  return { page, limit, skip: (page - 1) * limit };
};

export const getUsers = async (query: UserQuery = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.keyword) {
    const keywordRegex = new RegExp(String(query.keyword).trim(), "i");
    filter.$or = [{ email: keywordRegex }, { fullName: keywordRegex }];
  }

  if (query.role && ["CUSTOMER", "PROVIDER", "ADMIN"].includes(query.role)) {
    filter.role = query.role;
  }

  if (query.status && ["active", "locked"].includes(query.status)) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(SAFE_USER_PROJECTION)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getUserById = async (userId: string) => {
  assertObjectId(userId, "user id");

  const user = await User.findOne({ _id: userId, isDeleted: false }).select(
    SAFE_USER_PROJECTION,
  );

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  return user;
};

export const updateUserStatus = async (
  adminId: string,
  userId: string,
  status: "active" | "locked",
) => {
  assertObjectId(adminId, "admin id");
  assertObjectId(userId, "user id");

  if (adminId === userId && status === "locked") {
    throw new AppError("You cannot lock your own account", 400);
  }

  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  if (user.role === "ADMIN" && status === "locked") {
    throw new AppError("Admin accounts cannot be locked in this version", 400);
  }

  user.status = status;
  await user.save();

  if (status === "locked") {
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  return getUserById(userId);
};

export const getProviderApplications = providerApplicationService.getApplications;
export const getProviderApplicationById = providerApplicationService.getApplicationById;
export const reviewProviderApplication = providerApplicationService.reviewApplication;
export const getFeedbacks = listFeedbacks;
