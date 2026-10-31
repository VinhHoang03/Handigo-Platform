import mongoose, { Types } from "mongoose";
import { AppError } from "../utils/appError";
import User from "../models/user.model";
import { disconnectUserSockets } from "../sockets/socketServer";
import * as providerApplicationService from "./providerApplication.service";
import { getAdminFeedbacks as listFeedbacks, getAdminFeedbackDetail } from "./feedback.service";
import { getAdminOrderDetail } from "./adminOrderDetail.service";
import { SAFE_USER_PROJECTION } from "./user.service";
import { Violation } from "../models/violation.model";
import { updateUserStatusSchema, UpdateUserStatusPayload } from "../validations/admin.validator";
import { applyPenalty } from "./violation.service";
import { enqueueViolationEmail } from "./violationEmail.service";

interface UserQuery {
  keyword?: string;
  role?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Định danh ${fieldName} không hợp lệ`, 400);
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
    const keyword = String(query.keyword)
      .trim()
      .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    const keywordRegex = new RegExp(keyword, "i");
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
  assertObjectId(userId, "người dùng");

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
  payload: UpdateUserStatusPayload,
) => {
  assertObjectId(adminId, "quản trị viên");
  assertObjectId(userId, "người dùng");
  const parsed = updateUserStatusSchema.safeParse(payload);
  if (!parsed.success) throw new AppError("Thông tin xử lý tài khoản không hợp lệ. Vui lòng kiểm tra lý do, hình phạt và số ngày khóa.", 400);
  const decision = parsed.data;
  const { status } = decision;

  if (adminId === userId && status === "locked") {
    throw new AppError("Bạn không thể khóa tài khoản của chính mình", 400);
  }

  await mongoose.connection.transaction(async (session) => {
    // Ghi cùng tài khoản để các quyết định đồng thời xung đột và được kiểm tra lại.
    const user = await User.findOneAndUpdate({ _id: userId, isDeleted: false },
      { $inc: { __v: 1 } }, { new: true, runValidators: true, session });
    if (!user) throw new AppError("Không tìm thấy người dùng", 404);
    if (user.role === "ADMIN" && status === "locked") {
      throw new AppError("Không thể khóa tài khoản quản trị trong phiên bản này", 400);
    }
    if (user.status === status) {
      throw new AppError("Trạng thái tài khoản đã thay đổi hoặc thao tác đã được thực hiện. Vui lòng tải lại danh sách.", 409);
    }
    if (decision.status === "locked") {
      const now = new Date();
      const temporary = decision.penaltyType === "TEMPORARY_SUSPEND";
      const duration = decision.duration ?? decision.durationDays;
      const durationUnit = decision.durationUnit ?? "days";
      const durationLabel = `${duration} ${durationUnit === "hours" ? "giờ" : "ngày"}`;
      const endAt = temporary ? new Date(now.getTime() + duration! * (durationUnit === "hours" ? 3_600_000 : 86_400_000)) : null;
      const [violation] = await Violation.create([{
        userId: user._id, violationType: "Vi phạm quy định sử dụng Handigo",
        severity: decision.severity, penaltyType: decision.penaltyType,
        reason: decision.reason,
        adminDecision: temporary ? `Tạm khóa tài khoản ${durationLabel}` : "Khóa tài khoản vĩnh viễn",
        penalty: { type: decision.penaltyType,
          durationDays: temporary && durationUnit === "days" ? duration : null,
          ...(temporary ? { duration, durationUnit } : {}) },
        handledBy: adminId, startAt: now, appliedAt: now, endAt,
      }], { session });
      await applyPenalty(userId, decision.penaltyType, violation._id as Types.ObjectId, session);
      await enqueueViolationEmail(violation, user, session);
      return;
    }
    await User.updateOne({ _id: userId, isDeleted: false },
      { $set: { status }, $unset: { temporaryLockId: 1 } }, { session, runValidators: true });
    if (status === "active") await Violation.updateMany({ userId, status: "active", isDeleted: false,
      penaltyType: { $in: ["TEMPORARY_SUSPEND", "PERMANENT_BAN", "account_locked", "provider_suspended"] } },
      { $set: { status: "resolved" } }, { session, runValidators: true });
  });

  if (status === "locked") {
    disconnectUserSockets(userId);
  }

  return getUserById(userId);
};

export const getProviderApplications = providerApplicationService.getApplications;
export const getProviderApplicationById = providerApplicationService.getApplicationById;
export const reviewProviderApplication = providerApplicationService.reviewApplication;
export const getFeedbacks = listFeedbacks;
export const getFeedbackDetail = getAdminFeedbackDetail;
export const getOrderDetail = async (id: string) => {
  const result = await getAdminOrderDetail(id);
  if (!result.order) throw new AppError("Không tìm thấy đơn hàng.", 404);
  return result;
};
