import mongoose, { QueryFilter, Types, type ClientSession } from "mongoose";
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
import { withTransactionRetry } from '../utils/transaction';
import { createNotificationRecord, emitRealtimeNotification } from "./notification.service";

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
      .populate({ path: "providerId", select: "userId verified mainServiceText", populate: { path: "userId", select: "fullName email phone" } })
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

const updateServiceSuggestionInSession = async (
  suggestionId: string,
  data: UpdateServiceSuggestionPayload,
  adminId: string,
  session: ClientSession,
) => {
  ensureObjectId(suggestionId, "Mã đề xuất");
  ensureObjectId(adminId, "Mã admin");

  const suggestion = await ServiceSuggestion.findOne({
    _id: suggestionId,
    isDeleted: false,
  }).session(session);

  if (!suggestion) {
    throw new AppError("Không tìm thấy đề xuất", 404);
  }

  if (data.serviceDraft) {
    if (suggestion.suggestionType !== 'service') throw new AppError('Chỉ đề xuất dịch vụ mới được tạo dịch vụ.', 400);
    if (suggestion.status !== 'pending' || suggestion.createdServiceId) throw new AppError('Đề xuất đã được xử lý hoặc đã có dịch vụ liên kết. Vui lòng làm mới.', 409);
    if (data.status !== 'approved' || data.serviceDraft.isActive !== false || data.createdServiceId != null) throw new AppError('Dữ liệu duyệt và tạo dịch vụ không hợp lệ.', 400);
    if (data.categoryId !== undefined && data.categoryId !== data.serviceDraft.categoryId) throw new AppError('Danh mục đề xuất phải khớp danh mục dịch vụ mới.', 400);
    if (!await Category.exists({ _id: data.serviceDraft.categoryId, isDeleted: false }).session(session)) throw new AppError('Không tìm thấy danh mục.', 404);
  }

  const updateData: Partial<IServiceSuggestion> = {
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
      }).session(session);
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
      }).session(session);
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
      }).session(session);
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
        data.serviceDraft?.categoryId || data.categoryId ||
        suggestion.categoryId?.toString();

      if (!categoryId) {
        throw new AppError("Vui lòng chọn danh mục trước khi duyệt đề xuất dịch vụ", 400);
      }

      const createdService = await catalogService.createService(data.serviceDraft ? { ...data.serviceDraft } : {
        categoryId,
        name: suggestion.suggestedServiceName || "",
        description: suggestion.description,
        serviceType: "variable_price",
        fixedPrice: null,
        depositAmount: null,
        isActive: false,
      }, session);

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
      }, session);

      updateData.createdCategoryId = createdCategory._id;
    }
  }

  const updatedSuggestion = await ServiceSuggestion.findOneAndUpdate(
    { _id: suggestionId, isDeleted: false, ...(data.serviceDraft ? { status: 'pending', createdServiceId: null } : {}) },
    { $set: updateData },
    { new: true, runValidators: true, session },
  ).lean<IServiceSuggestion>();

  if (!updatedSuggestion) {
    throw new AppError("Đề xuất đã thay đổi. Vui lòng làm mới để kiểm tra lại.", 409);
  }
  let notification = null;
  if (data.adminNote?.trim()) {
    const provider = await Provider.findOne({
      _id: suggestion.providerId,
      isDeleted: false,
    }).select("userId").session(session);
    if (!provider) throw new AppError("Không tìm thấy người gửi đề xuất", 404);

    notification = await createNotificationRecord({
      userId: provider.userId,
      type: "SYSTEM",
      title: "Phản hồi đề xuất của bạn",
      content: `Đề xuất “${suggestion.suggestedServiceName || suggestion.suggestedCategoryName || ""}”: ${data.adminNote.trim()}`,
      data: { suggestionId, actionUrl: "/provider/service-suggestions" },
    }, { session, deferRealtime: true });
  }
  return { suggestion: updatedSuggestion, notification };
};

export const updateServiceSuggestion = async (suggestionId: string, data: UpdateServiceSuggestionPayload, adminId: string): Promise<IServiceSuggestion> => {
  ensureObjectId(suggestionId, 'Mã đề xuất');
  ensureObjectId(adminId, 'Mã admin');
  const session = await mongoose.startSession();
  try {
    const result = await withTransactionRetry(session, () => updateServiceSuggestionInSession(suggestionId, data, adminId, session));
    if (!result) throw new AppError('Không thể cập nhật đề xuất. Vui lòng thử lại.', 409);
    if (result.notification) emitRealtimeNotification(result.notification);
    return await getServiceSuggestionById(suggestionId);
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw new AppError('Dịch vụ hoặc danh mục đã tồn tại. Vui lòng kiểm tra lại tên và đường dẫn.', 409);
    throw error;
  } finally { await session.endSession(); }
};

export const getServiceSuggestionById = async (suggestionId: string) => {
  ensureObjectId(suggestionId, "Mã đề xuất");

  const suggestion = await ServiceSuggestion.findOne({
    _id: suggestionId,
    isDeleted: false,
  })
    .populate({ path: "providerId", select: "userId verified mainServiceText", populate: { path: "userId", select: "fullName email phone" } })
    .populate("categoryId", "name slug isActive")
    .populate("createdServiceId", "name slug categoryId isActive")
    .populate("createdCategoryId", "name slug isActive")
    .populate("reviewedBy", "fullName email role");

  if (!suggestion) {
    throw new AppError("Không tìm thấy đề xuất", 404);
  }

  return suggestion;
};
