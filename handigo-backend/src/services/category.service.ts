import { QueryFilter, Types } from "mongoose";
import { randomInt } from "node:crypto";
import { Category, ICategory } from "../models/category.model";
import { Service } from "../models/service.model";
import { AppError } from "../utils/appError";

interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  isActive?: boolean;
}

interface ListCategoriesQuery {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
}

interface CategoryQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  isActive?: boolean | string;
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

const ensureValidId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid category id", 400);
  }
};

const ensureUniqueSlug = async (slug: string, excludeId?: string) => {
  const filter: QueryFilter<ICategory> = { slug };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Category.exists(filter)) {
    throw new AppError("Category slug already exists", 409);
  }
};

const resolveUniqueIconColor = async (value?: string | null, excludeId?: string) => {
  const filter: QueryFilter<ICategory> = { isDeleted: false };
  if (excludeId) filter._id = { $ne: excludeId };
  if (value) {
    const iconColor = value.trim().toLowerCase();
    if (await Category.exists({ ...filter, iconColor }).collation({ locale: "en", strength: 2 })) {
      throw new AppError("Mã màu này đã được dùng cho danh mục khác. Vui lòng chọn màu khác.", 409);
    }
    return iconColor;
  }
  const categories = await Category.find(filter).select("iconColor").lean();
  const usedColors = new Set(categories.map((category) => category.iconColor?.toLowerCase()));
  let iconColor = "#3525cd";
  while (usedColors.has(iconColor)) {
    iconColor = `#${randomInt(0x100000, 0xe00000).toString(16).padStart(6, "0")}`;
  }
  return iconColor;
};

const rethrowCategoryWriteError = (error: unknown): never => {
  const duplicate = error as { code?: number; keyPattern?: Record<string, unknown> } | null;
  if (duplicate?.code === 11000 && duplicate.keyPattern?.iconColor) {
    throw new AppError("Mã màu này vừa được dùng cho danh mục khác. Vui lòng chọn màu khác.", 409);
  }
  throw error;
};

export const listCategories = async (query: ListCategoriesQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filter: QueryFilter<ICategory> = { isDeleted: false };

  if (query.search?.trim()) {
    const search = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }
  if (query.isActive === "true" || query.isActive === "false") {
    filter.isActive = query.isActive === "true";
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getCategoryById = async (id: string) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new AppError("Category not found", 404);

  const services = await Service.find({
    categoryId: category._id,
    isDeleted: false,
  }).sort({ createdAt: -1 });

  return { ...category.toObject(), services };
};

export const createCategory = async (data: CategoryInput) => {
  await Category.init();
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Unable to generate a valid slug", 400);
  await ensureUniqueSlug(slug);
  const iconColor = await resolveUniqueIconColor(data.iconColor);
  try {
    return await Category.create({ ...data, slug, iconColor });
  } catch (error) {
    return rethrowCategoryWriteError(error);
  }
};

export const updateCategory = async (id: string, data: CategoryInput) => {
  ensureValidId(id);
  await Category.init();
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new AppError("Category not found", 404);

  const slug = data.slug || (data.name ? slugify(data.name) : undefined);
  if (slug) {
    await ensureUniqueSlug(slug, id);
    data.slug = slug;
  }

  const iconColor = await resolveUniqueIconColor(
    data.iconColor === undefined ? category.iconColor : data.iconColor,
    id,
  );
  Object.assign(category, data, { iconColor });
  try {
    return await category.save();
  } catch (error) {
    return rethrowCategoryWriteError(error);
  }
};

export const deleteCategory = async (id: string) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new AppError("Category not found", 404);

  const hasServices = await Service.exists({
    categoryId: id,
    isDeleted: false,
  });
  if (hasServices) {
    throw new AppError(
      "Cannot delete a category that still contains services",
      409,
    );
  }

  category.isDeleted = true;
  category.deletedAt = new Date();
  category.isActive = false;
  await category.save();
};

export const getActiveCategories = async () => {
  return Category.find({
    isActive: true,
    isDeleted: false,
  })
    .select("name slug icon iconColor isActive sortOrder")
    .sort({ sortOrder: 1, name: 1 });
};

export const getActiveCategoriesWithServices = async () => {
  const categories = await Category.find({
    isActive: true,
    isDeleted: false,
  })
    .select("name slug icon iconColor isActive sortOrder")
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const services = await Service.find({
    categoryId: { $in: categories.map((category) => category._id) },
    isActive: true,
    isDeleted: false,
  })
    .select("categoryId name slug serviceType fixedPrice depositAmount image coverImage galleryImages")
    .sort({ name: 1 })
    .lean();

  const servicesByCategory = services.reduce<Record<string, typeof services>>(
    (groups, service) => {
      const key = service.categoryId.toString();
      groups[key] = groups[key] || [];
      service.coverImage = service.coverImage === undefined ? service.image : service.coverImage;
      service.image = service.coverImage;
      groups[key].push(service);
      return groups;
    },
    {},
  );

  return categories.map((category) => ({
    ...category,
    services: servicesByCategory[category._id.toString()] || [],
  }));
};

export const getCategories = async (query: CategoryQuery = {}) => {
  const page = Math.max(query.page || 1, 1);
  const limit = Math.min(Math.max(query.limit || 20, 1), 100);
  const filter: QueryFilter<ICategory> = { isDeleted: false };

  if (query.keyword?.trim()) {
    const keyword = query.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { slug: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }

  if (query.isActive !== undefined) {
    filter.isActive =
      typeof query.isActive === "string"
        ? query.isActive === "true"
        : query.isActive;
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
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
