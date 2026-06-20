import { QueryFilter, Types } from "mongoose";
import { Category } from "../models/category.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";
import {
  IServiceSuggestion,
  ServiceSuggestion,
} from "../models/serviceSuggestion.model";
import { AppError } from "../utils/appError";
import {
  CreateServiceSuggestionPayload,
  ListServiceSuggestionQuery,
  UpdateServiceSuggestionPayload,
} from "../validations/serviceSuggestion.validator";
import * as categoryService from "./category.service";
import * as catalogService from "./service.service";

const ensureObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
};

const getProviderByUserId = async (userId: string) => {
  ensureObjectId(userId, "Mã người dùng");

  const provider = await Provider.findOne({
    userId: new Types.ObjectId(userId),
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ provider", 404);
  }

  return provider;
};

export const createServiceSuggestion = async (
  userId: string,
  data: CreateServiceSuggestionPayload,
): Promise<IServiceSuggestion> => {
  const provider = await getProviderByUserId(userId);

  if (data.categoryId) {
    ensureObjectId(data.categoryId, "Mã danh mục");
    const category = await Category.exists({
      _id: data.categoryId,
      isDeleted: false,
    });
    if (!category) {
      throw new AppError("Không tìm thấy danh mục", 404);
    }
  }

  return ServiceSuggestion.create({
    providerId: provider._id,
    suggestionType: data.suggestionType,
    suggestedServiceName: data.suggestedServiceName?.trim() ?? null,
    suggestedCategoryName: data.suggestedCategoryName?.trim() ?? null,
    categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
    description: data.description?.trim() ?? null,
    status: "pending",
  });
};

export const getServiceSuggestions = async (
  filter: ListServiceSuggestionQuery,
): Promise<{ suggestions: IServiceSuggestion[]; total: number }> => {
  const query: QueryFilter<IServiceSuggestion> = { isDeleted: false };

  if (filter.status) {
    query.status = filter.status;
  }
  if (filter.suggestionType) {
    query.suggestionType = filter.suggestionType;
  }
  if (filter.providerId) {
    ensureObjectId(filter.providerId, "Mã provider");
    query.providerId = new Types.ObjectId(filter.providerId);
  }
  if (filter.startDate || filter.endDate) {
    query.createdAt = {};
    if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
    if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
  }

  const limit = filter.limit;
  const page = filter.page;
  const skip = (page - 1) * limit;

  const [suggestions, total] = await Promise.all([
    ServiceSuggestion.find(query)
      .populate("providerId", "userId verified mainServiceText")
      .populate("providerId.userId", "fullName email phone")
      .populate("categoryId", "name slug isActive")
      .populate("createdServiceId", "name slug categoryId isActive")
      .populate("createdCategoryId", "name slug isActive")
      .populate("reviewedBy", "fullName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ServiceSuggestion.countDocuments(query),
  ]);

  return { suggestions, total };
};

export const updateServiceSuggestion = async (
  suggestionId: string,
  data: UpdateServiceSuggestionPayload,
  adminId: string,
): Promise<IServiceSuggestion> => {
  ensureObjectId(suggestionId, "Mã đề xuất");
  ensureObjectId(adminId, "Mã admin");

  const suggestion = await ServiceSuggestion.findOne({
    _id: suggestionId,
    isDeleted: false,
  });

  if (!suggestion) {
    throw new AppError("Không tìm thấy đề xuất", 404);
  }

  const updateData: any = {
    reviewedBy: new Types.ObjectId(adminId),
    reviewedAt: new Date(),
  };

  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.adminNote !== undefined) {
    updateData.adminNote = data.adminNote?.trim() ?? null;
  }
  if (data.categoryId !== undefined) {
    if (suggestion.suggestionType !== "service") {
      throw new AppError("Chỉ đề xuất dịch vụ mới được gắn danh mục", 400);
    }
    if (data.categoryId !== null) {
      ensureObjectId(data.categoryId, "Mã danh mục");
      const category = await Category.exists({
        _id: data.categoryId,
        isDeleted: false,
      });
      if (!category) {
        throw new AppError("Không tìm thấy danh mục", 404);
      }
    }
    updateData.categoryId =
      data.categoryId ? new Types.ObjectId(data.categoryId) : null;
  }
  if (data.createdServiceId !== undefined) {
    if (suggestion.suggestionType !== "service") {
      throw new AppError("Chỉ đề xuất dịch vụ mới được gắn dịch vụ đã tạo", 400);
    }
    if (data.createdServiceId !== null) {
      ensureObjectId(data.createdServiceId, "Mã dịch vụ");
      const service = await Service.exists({
        _id: data.createdServiceId,
        isDeleted: false,
      });
      if (!service) {
        throw new AppError("Không tìm thấy dịch vụ đã tạo", 404);
      }
    }
    updateData.createdServiceId =
      data.createdServiceId ? new Types.ObjectId(data.createdServiceId) : null;
  }
  if (data.createdCategoryId !== undefined) {
    if (suggestion.suggestionType !== "category") {
      throw new AppError("Chỉ đề xuất danh mục mới được gắn danh mục đã tạo", 400);
    }
    if (data.createdCategoryId !== null) {
      ensureObjectId(data.createdCategoryId, "Mã danh mục");
      const category = await Category.exists({
        _id: data.createdCategoryId,
        isDeleted: false,
      });
      if (!category) {
        throw new AppError("Không tìm thấy danh mục đã tạo", 404);
      }
    }
    updateData.createdCategoryId =
      data.createdCategoryId ? new Types.ObjectId(data.createdCategoryId) : null;
  }

  if (data.status === "approved") {
    if (
      suggestion.suggestionType === "service" &&
      !suggestion.createdServiceId &&
      !updateData.createdServiceId
    ) {
      const categoryId =
        data.categoryId ||
        suggestion.categoryId?.toString();

      if (!categoryId) {
        throw new AppError("Vui lòng chọn danh mục trước khi duyệt đề xuất dịch vụ", 400);
      }

      const createdService = await catalogService.createService({
        categoryId,
        name: suggestion.suggestedServiceName || "",
        description: suggestion.description,
        serviceType: "variable_price",
        fixedPrice: null,
        depositAmount: null,
        isActive: true,
      });

      updateData.categoryId = new Types.ObjectId(categoryId);
      updateData.createdServiceId = createdService._id;
    }

    if (
      suggestion.suggestionType === "category" &&
      !suggestion.createdCategoryId &&
      !updateData.createdCategoryId
    ) {
      const createdCategory = await categoryService.createCategory({
        name: suggestion.suggestedCategoryName || "",
        description: suggestion.description,
        isActive: true,
      });

      updateData.createdCategoryId = createdCategory._id;
    }
  }

  const updatedSuggestion = await ServiceSuggestion.findByIdAndUpdate(
    suggestionId,
    { $set: updateData },
    { new: true, runValidators: true },
  )
    .populate("providerId", "userId verified mainServiceText")
    .populate("categoryId", "name slug isActive")
    .populate("createdServiceId", "name slug categoryId isActive")
    .populate("createdCategoryId", "name slug isActive")
    .populate("reviewedBy", "fullName email role")
    .lean<IServiceSuggestion>();

  if (!updatedSuggestion) {
    throw new AppError("Không tìm thấy đề xuất", 404);
  }
  return updatedSuggestion;
};

export const getServiceSuggestionById = async (suggestionId: string) => {
  ensureObjectId(suggestionId, "Mã đề xuất");

  const suggestion = await ServiceSuggestion.findOne({
    _id: suggestionId,
    isDeleted: false,
  })
    .populate("providerId", "userId verified mainServiceText")
    .populate("categoryId", "name slug isActive")
    .populate("createdServiceId", "name slug categoryId isActive")
    .populate("createdCategoryId", "name slug isActive")
    .populate("reviewedBy", "fullName email role");

  if (!suggestion) {
    throw new AppError("Không tìm thấy đề xuất", 404);
  }

  return suggestion;
};
