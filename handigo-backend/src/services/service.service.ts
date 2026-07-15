import { QueryFilter, Types } from "mongoose";
import { Category } from "../models/category.model";
import { Order } from "../models/order.model";
import { IService, Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { AppError } from "../utils/appError";

interface ServiceInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  serviceType?: "fixed_price" | "variable_price";
  fixedPrice?: number | null;
  depositAmount?: number | null;
  image?: string | null;
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

  if (data.serviceType === "fixed_price") {
    data.depositAmount = null;
    if (isActive && (!data.fixedPrice || data.fixedPrice <= 0)) {
      throw new AppError(
        "Dịch vụ giá cố định đang hoạt động phải có giá lớn hơn 0.",
        400,
      );
    }
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

  return {
    items,
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
  return service;
};

export const createService = async (data: ServiceInput) => {
  normalizeAndValidatePricing(data);
  await ensureCategoryExists(data.categoryId!, data.isActive ?? true);
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Unable to generate a valid slug", 400);
  await ensureUniqueSlug(data.categoryId!, slug);

  return Service.create({ ...data, slug, image: normalizeImageUrl(data.image) });
};

export const updateService = async (id: string, data: ServiceInput) => {
  ensureValidId(id);
  const service = await Service.findOne({ _id: id, isDeleted: false });
  if (!service) throw new AppError("Service not found", 404);

  const categoryId = data.categoryId || service.categoryId.toString();
  const nextData: ServiceInput = {
    categoryId,
    name: data.name ?? service.name,
    slug: data.slug ?? service.slug,
    description: data.description === undefined ? service.description : data.description,
    serviceType: data.serviceType ?? service.serviceType,
    fixedPrice: data.fixedPrice === undefined ? service.fixedPrice : data.fixedPrice,
    depositAmount:
      data.depositAmount === undefined ? service.depositAmount : data.depositAmount,
    image: data.image === undefined ? service.image : data.image,
    isActive: data.isActive ?? service.isActive,
  };
  normalizeAndValidatePricing(nextData, service.isActive);
  await ensureCategoryExists(categoryId, nextData.isActive);

  const slug = data.slug || (data.name ? slugify(data.name) : service.slug);
  await ensureUniqueSlug(categoryId, slug, id);

  Object.assign(service, {
    ...nextData,
    categoryId,
    slug,
    ...(data.image !== undefined ? { image: normalizeImageUrl(data.image) } : {}),
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
