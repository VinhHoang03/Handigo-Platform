import { QueryFilter, Types } from "mongoose";
import { Category } from "../models/category.model";
import { IService, Service } from "../models/service.model";
import { AppError } from "../utils/appError";

interface ServiceInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  serviceType?: "fixed_price" | "variable_price";
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

const ensureValidId = (id: string, field = "service") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field} id`, 400);
  }
};

const ensureCategoryExists = async (categoryId: string) => {
  ensureValidId(categoryId, "category");
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });
  if (!category) throw new AppError("Category not found", 404);
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
  await ensureCategoryExists(data.categoryId!);
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Unable to generate a valid slug", 400);
  await ensureUniqueSlug(data.categoryId!, slug);

  return Service.create({ ...data, slug });
};

export const updateService = async (id: string, data: ServiceInput) => {
  ensureValidId(id);
  const service = await Service.findOne({ _id: id, isDeleted: false });
  if (!service) throw new AppError("Service not found", 404);

  const categoryId = data.categoryId || service.categoryId.toString();
  if (data.categoryId) await ensureCategoryExists(data.categoryId);

  const slug = data.slug || (data.name ? slugify(data.name) : service.slug);
  await ensureUniqueSlug(categoryId, slug, id);

  Object.assign(service, { ...data, categoryId, slug });
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
};
