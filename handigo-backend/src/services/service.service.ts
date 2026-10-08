import { QueryFilter, Types } from "mongoose";
import { Category } from "../models/category.model";
import { Order } from "../models/order.model";
import { IService, IServiceProcessStep, IServiceOptionGroup, Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Feedback } from "../models/feedback.model";
import { AppError } from "../utils/appError";
import { isAirConditionerCleaning } from "../utils/airConditionerCleaning";

import { validateNewServiceImages } from "./serviceImage.service";

interface ServiceInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  processSteps?: IServiceProcessStep[];
  optionGroups?: Array<Omit<IServiceOptionGroup, "_id"> & { _id?: string | Types.ObjectId }>;
  serviceType?: "fixed_price" | "variable_price";
  fixedPrice?: number | null;
  depositAmount?: number | null;
  image?: string | null;
  coverImage?: string | null;
  galleryImages?: string[];
  requiresOptionSelection?: boolean;
  isActive?: boolean;
}

interface ListServicesQuery {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  serviceType?: string;
  isActive?: string;
  bookedOnly?: string;
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeImageUrl = (value?: string | null) => {
  if (!value) return value;
  return value
    .trim()
    .replace(/^http:\/\/res\.cloudinary\.com/i, "https://res.cloudinary.com");
};

const ensureValidId = (id: string, field = "service") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field} id`, 400);
  }
};

const ensureCategoryExists = async (categoryId: string, requireActive = false) => {
  ensureValidId(categoryId, "category");
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });
  if (!category) throw new AppError("Không tìm thấy danh mục.", 404);
  if (requireActive && !category.isActive) {
    throw new AppError("Không thể kích hoạt dịch vụ trong danh mục đang tạm ngừng.", 400);
  }
};

const normalizeAndValidatePricing = (data: ServiceInput, defaultActive = true) => {
  const isActive = data.isActive ?? defaultActive;

  if (isAirConditionerCleaning(data)) {
    if (typeof data.fixedPrice !== "number" || !Number.isFinite(data.fixedPrice) || data.fixedPrice <= 0) {
      throw new AppError("Vui lòng nhập giá vệ sinh điều hòa lớn hơn 0 cho mỗi máy.", 400);
    }
    data.serviceType = "fixed_price";
    data.depositAmount = null;
    data.requiresOptionSelection = false;
    return;
  }

  if (data.serviceType === "fixed_price") {
    data.depositAmount = null;
    data.fixedPrice = null;
    data.requiresOptionSelection = true;
  }

  if (data.serviceType === "variable_price") {
    data.fixedPrice = null;
    if (isActive && data.depositAmount == null) {
      throw new AppError(
        "Dịch vụ giá linh hoạt đang hoạt động phải có tiền đặt cọc.",
        400,
      );
    }
  }
};

const ensureUniqueSlug = async (
  categoryId: string,
  slug: string,
  excludeId?: string,
) => {
  const filter: QueryFilter<IService> = { categoryId, slug };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Service.exists(filter)) {
    throw new AppError("Service slug already exists in this category", 409);
  }
};

export const listServices = async (query: ListServicesQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filter: QueryFilter<IService> = { isDeleted: false };

  if (query.search?.trim()) {
    const search = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }
  if (query.categoryId) {
    ensureValidId(query.categoryId, "category");
    filter.categoryId = query.categoryId;
  }
  if (
    query.serviceType === "fixed_price" ||
    query.serviceType === "variable_price"
  ) {
    filter.serviceType = query.serviceType;
  }
  if (query.isActive === "true" || query.isActive === "false") {
    filter.isActive = query.isActive === "true";
  }
  if (query.bookedOnly === "true") {
    const bookedServiceIds = await Order.distinct("serviceId", {
      isDeleted: false,
    });
    filter._id = { $in: bookedServiceIds };
  }

  const [items, total] = await Promise.all([
    Service.find(filter)
      .populate("categoryId", "name slug isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Service.countDocuments(filter),
  ]);

  const minimumOptionPrices = await ServiceOption.aggregate<{
    _id: Types.ObjectId;
    minOptionPrice: number;
  }>([
    {
      $match: {
        serviceId: { $in: items.map((item) => item._id) },
        price: { $gt: 0 },
        isActive: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$serviceId",
        minOptionPrice: { $min: "$price" },
      },
    },
  ]);
  const minimumOptionPriceByServiceId = new Map(
    minimumOptionPrices.map((item) => [
      item._id.toString(),
      item.minOptionPrice,
    ]),
  );

  const ratingStats = await Feedback.aggregate<{
    _id: Types.ObjectId;
    averageRating: number;
    totalFeedbacks: number;
  }>([
    {
      $match: {
        serviceId: { $in: items.map((item) => item._id) },
        isVisible: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$serviceId",
        averageRating: { $avg: "$rating" },
        totalFeedbacks: { $sum: 1 },
      },
    },
  ]);
  const ratingByServiceId = new Map(
    ratingStats.map((item) => [item._id.toString(), item]),
  );

  return {
    items: items.map((item) => ({
      ...item.toObject(),
      minOptionPrice:
        isAirConditionerCleaning(item)
          ? null
          : minimumOptionPriceByServiceId.get(item._id.toString()) ?? null,
      averageRating: Number(
        (ratingByServiceId.get(item._id.toString())?.averageRating ?? 0).toFixed(1),
      ),
      totalFeedbacks:
        ratingByServiceId.get(item._id.toString())?.totalFeedbacks ?? 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getServiceById = async (id: string) => {
  ensureValidId(id);
  const service = await Service.findOne({ _id: id, isDeleted: false }).populate(
    "categoryId",
    "name slug isActive",
  );
  if (!service) throw new AppError("Service not found", 404);

  const [ratingStats, totalCompletedOrders] = await Promise.all([
    Feedback.aggregate<{ averageRating: number; totalFeedbacks: number }>([
      {
        $match: {
          serviceId: service._id,
          isVisible: true,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalFeedbacks: { $sum: 1 },
        },
      },
    ]),
    Order.countDocuments({
      serviceId: service._id,
      status: "completed",
      isDeleted: false,
    }),
  ]);

  const stats = ratingStats[0];
  service.set({
    averageRating: Number((stats?.averageRating ?? 0).toFixed(1)),
    totalFeedbacks: stats?.totalFeedbacks ?? 0,
    totalCompletedOrders,
  }, undefined, { strict: false });

  return service;
};

export const createService = async (data: ServiceInput) => {
  const names = (data.optionGroups ?? []).map(group => group.name.trim().toLocaleLowerCase("vi"));
  if (new Set(names).size !== names.length) throw new AppError("Tên nhóm tùy chọn không được trùng nhau.", 400);
  if ((data.isActive ?? true) && data.optionGroups?.some(group => group.isRequired)) {
    throw new AppError("Hãy tạo dịch vụ tạm ngừng, gán tùy chọn cho nhóm bắt buộc rồi kích hoạt.", 400);
  }
  normalizeAndValidatePricing(data);
  await ensureCategoryExists(data.categoryId!, data.isActive ?? true);
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Unable to generate a valid slug", 400);
  await ensureUniqueSlug(data.categoryId!, slug);

  const coverImage = normalizeImageUrl(data.coverImage !== undefined ? data.coverImage : data.image) ?? null;
  await validateNewServiceImages([...(coverImage ? [coverImage] : []), ...(data.galleryImages ?? [])]);
  return Service.create({ ...data, slug, coverImage, image: undefined });
};

export const updateService = async (id: string, data: ServiceInput) => {
  ensureValidId(id);
  const service = await Service.findOne({ _id: id, isDeleted: false });
  if (!service) throw new AppError("Service not found", 404);

  if (data.optionGroups !== undefined || data.isActive === true) {
    const groups = data.optionGroups ?? service.optionGroups ?? [];
    const names = groups.map(group => group.name.trim().toLocaleLowerCase("vi"));
    const ids = groups.flatMap(group => group._id ? [group._id.toString()] : []);
    if (new Set(names).size !== names.length || new Set(ids).size !== ids.length) {
      throw new AppError("Tên hoặc mã nhóm tùy chọn không được trùng nhau.", 400);
    }
    const options = await ServiceOption.find({ serviceId: service._id, isDeleted: false });
    if (options.some(option => option.groupId && !ids.includes(option.groupId.toString()))) {
      throw new AppError("Vui lòng chuyển các tùy chọn sang nhóm khác trước khi xóa nhóm.", 400);
    }
    if ((data.isActive ?? service.isActive) && groups.some(group => group.isRequired
      && !options.some(option => option.isActive && option.groupId?.toString() === group._id?.toString()))) {
      throw new AppError("Nhóm bắt buộc phải có ít nhất một tùy chọn đang hoạt động.", 400);
    }
  }

  const oldCover = service.coverImage === undefined ? service.image : service.coverImage;
  const coverImage = normalizeImageUrl(data.coverImage !== undefined ? data.coverImage : data.image !== undefined ? data.image : oldCover);
  const galleryImages = data.galleryImages ?? service.galleryImages ?? [];
  await validateNewServiceImages([...(coverImage ? [coverImage] : []), ...galleryImages], [...(oldCover ? [normalizeImageUrl(oldCover)!] : []), ...(service.galleryImages ?? [])]);
  const categoryId = data.categoryId || service.categoryId.toString();
  const nextData: ServiceInput = {
    categoryId,
    name: data.name ?? service.name,
    slug: data.slug ?? service.slug,
    description: data.description === undefined ? service.description : data.description,
    processSteps: data.processSteps === undefined ? service.processSteps : data.processSteps,
    optionGroups: data.optionGroups ?? service.optionGroups,
    serviceType: data.serviceType ?? service.serviceType,
    fixedPrice: data.fixedPrice === undefined ? service.fixedPrice : data.fixedPrice,
    depositAmount:
      data.depositAmount === undefined ? service.depositAmount : data.depositAmount,
    image: undefined,
    coverImage,
    galleryImages,
    requiresOptionSelection:
      data.requiresOptionSelection ?? service.requiresOptionSelection,
    isActive: data.isActive ?? service.isActive,
  };
  if (data.serviceType !== undefined && data.serviceType !== service.serviceType
    || data.fixedPrice !== undefined && data.fixedPrice !== service.fixedPrice
    || data.depositAmount !== undefined && data.depositAmount !== service.depositAmount) {
    normalizeAndValidatePricing(nextData, service.isActive);
  }
  await ensureCategoryExists(categoryId, nextData.isActive);

  const slug = data.slug || (data.name ? slugify(data.name) : service.slug);
  await ensureUniqueSlug(categoryId, slug, id);

  Object.assign(service, {
    ...nextData,
    categoryId,
    slug,

  });
  return service.save();
};

export const deleteService = async (id: string) => {
  ensureValidId(id);
  const service = await Service.findOne({ _id: id, isDeleted: false });
  if (!service) throw new AppError("Service not found", 404);

  service.isDeleted = true;
  service.deletedAt = new Date();
  service.isActive = false;
  await service.save();
  await ServiceOption.updateMany(
    { serviceId: service._id, isDeleted: false },
    { $set: { isActive: false } },
  );
};
