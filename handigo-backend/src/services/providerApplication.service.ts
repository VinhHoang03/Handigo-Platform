import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import User from "../models/user.model";
import { Provider } from "../models/provider.model";
import { ProviderApplication } from "../models/providerApplication.model";
import { Category } from "../models/category.model";

interface CreateProviderApplicationPayload {
  description: string;
  experienceYears: number;
  serviceCategoryIds: string[];
  workingAreas: string[];
}

interface ReviewProviderApplicationPayload {
  status: "approved" | "rejected";
  rejectionReason?: string;
}

interface ApplicationQuery {
  status?: string;
  keyword?: string;
  categoryId?: string;
  page?: string | number;
  limit?: string | number;
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getPagination = (query: ApplicationQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

  return { page, limit, skip: (page - 1) * limit };
};

const assertCategoriesActive = async (categoryIds: string[]) => {
  const uniqueIds = [...new Set(categoryIds)];
  const count = await Category.countDocuments({
    _id: { $in: uniqueIds },
    isActive: true,
    isDeleted: false,
  });

  if (count !== uniqueIds.length) {
    throw new AppError("One or more service categories are invalid", 400);
  }
};

export const createApplication = async (
  userId: string,
  payload: CreateProviderApplicationPayload,
) => {
  assertObjectId(userId, "user id");
  await assertCategoriesActive(payload.serviceCategoryIds);

  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.status !== "active") {
    throw new AppError("Account is not active", 403);
  }

  if (user.role !== "CUSTOMER") {
    throw new AppError("Only customers can apply to become providers", 403);
  }

  const pendingApplication = await ProviderApplication.findOne({
    userId,
    status: "pending",
    isDeleted: false,
  });

  if (pendingApplication) {
    throw new AppError("You already have a pending provider application", 400);
  }

  return ProviderApplication.create({
    userId,
    description: payload.description,
    experienceYears: payload.experienceYears,
    serviceCategoryIds: payload.serviceCategoryIds,
    workingAreas: payload.workingAreas,
    status: "pending",
  });
};

export const getMyApplication = async (userId: string) => {
  assertObjectId(userId, "user id");

  return ProviderApplication.findOne({ userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate("serviceCategoryIds", "name slug icon")
    .populate("reviewedBy", "fullName email");
};

export const getApplications = async (query: ApplicationQuery = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status && ["pending", "approved", "rejected"].includes(query.status)) {
    filter.status = query.status;
  }

  if (query.keyword) {
    const keywordRegex = new RegExp(String(query.keyword).trim(), "i");
    const users = await User.find({
      isDeleted: false,
      $or: [{ email: keywordRegex }, { fullName: keywordRegex }],
    }).select("_id");

    filter.userId = { $in: users.map((user) => user._id) };
  }

  if (query.categoryId) {
    assertObjectId(String(query.categoryId), "category id");
    filter.serviceCategoryIds = new Types.ObjectId(String(query.categoryId));
  }

  const [items, total] = await Promise.all([
    ProviderApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullName email phone avatar role status")
      .populate("serviceCategoryIds", "name slug icon")
      .populate("reviewedBy", "fullName email"),
    ProviderApplication.countDocuments(filter),
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

export const getApplicationById = async (applicationId: string) => {
  assertObjectId(applicationId, "application id");

  const application = await ProviderApplication.findOne({
    _id: applicationId,
    isDeleted: false,
  })
    .populate("userId", "fullName email phone avatar role status")
    .populate("serviceCategoryIds", "name slug icon")
    .populate("reviewedBy", "fullName email");

  if (!application) {
    throw new AppError("Provider application not found", 404);
  }

  return application;
};

export const reviewApplication = async (
  adminId: string,
  applicationId: string,
  payload: ReviewProviderApplicationPayload,
) => {
  assertObjectId(adminId, "admin id");
  assertObjectId(applicationId, "application id");

  const application = await ProviderApplication.findOne({
    _id: applicationId,
    isDeleted: false,
  });

  if (!application) {
    throw new AppError("Provider application not found", 404);
  }

  if (application.status !== "pending") {
    throw new AppError("Only pending applications can be reviewed", 400);
  }

  application.status = payload.status;
  application.reviewedBy = new Types.ObjectId(adminId);
  application.reviewedAt = new Date();

  if (payload.status === "rejected") {
    application.rejectionReason = payload.rejectionReason || null;
    await application.save();
    return getApplicationById(applicationId);
  }

  application.rejectionReason = null;

  await Promise.all([
    Provider.findOneAndUpdate(
      { userId: application.userId },
      {
        userId: application.userId,
        description: application.description,
        experienceYears: application.experienceYears,
        serviceCategoryIds: application.serviceCategoryIds,
        workingAreas: application.workingAreas,
        activeStatus: "inactive",
        verified: true,
        isDeleted: false,
        deletedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
    User.findByIdAndUpdate(application.userId, { role: "PROVIDER" }),
    application.save(),
  ]);

  return getApplicationById(applicationId);
};
