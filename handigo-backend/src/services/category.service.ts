import { catalogStatus, catalogStatusFilter } from "../utils/catalogStatus";
import { QueryFilter, Types, type ClientSession } from "mongoose";
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
    throw new AppError("Định danh danh mục không hợp lệ", 400);
  }
};

const ensureUniqueSlug = async (slug: string, excludeId?: string, session?: ClientSession) => {
  const filter: QueryFilter<ICategory> = { slug };
  if (excludeId) filter._id = { $ne: excludeId };

  const query = Category.exists(filter);
  if (await (session ? query.session(session) : query)) {
    throw new AppError("Đường dẫn danh mục đã tồn tại", 409);
  }
};

const resolveUniqueIconColor = async (value?: string | null, excludeId?: string, session?: ClientSession) => {
  const filter: QueryFilter<ICategory> = { isDeleted: false };
  if (excludeId) filter._id = { $ne: excludeId };
  if (value) {
    const iconColor = value.trim().toLowerCase();
    const query = Category.exists({ ...filter, iconColor }).collation({ locale: "en", strength: 2 });
    if (await (session ? query.session(session) : query)) {
      throw new AppError("Mã màu này đã được dùng cho danh mục khác. Vui lòng chọn màu khác.", 409);
    }
    return iconColor;
  }
  const query = Category.find(filter).select("iconColor");
  const categories = await (session ? query.session(session) : query).lean();
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

export const listCategories = async (query: ListCategoriesQuery, admin = false) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filter: QueryFilter<ICategory> = admin ? { $and: [catalogStatusFilter(query.isActive)] } : { isDeleted: false, isActive: true };

  if (query.search?.trim()) {
    const search = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort(admin ? { isDeleted: 1, isActive: -1, createdAt: -1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    items: admin ? items.map(item => catalogStatus(item.toObject())) : items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getCategoryById = async (id: string, admin = false) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id, ...(admin ? {} : { isDeleted: false, isActive: true }) });
  if (!category) throw new AppError("Không tìm thấy danh mục", 404);

  const services = await Service.find({
    categoryId: category._id,
    ...(admin ? {} : { isDeleted: false, isActive: true }),
  }).sort({ createdAt: -1 });

  return { ...catalogStatus(category.toObject()), services: services.map(item => catalogStatus(item.toObject())) };
};

export const createCategory = async (data: CategoryInput, session?: ClientSession) => {
  await Category.init();
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Không thể tạo đường dẫn hợp lệ", 400);
  await ensureUniqueSlug(slug, undefined, session);
  const iconColor = await resolveUniqueIconColor(data.iconColor, undefined, session);
  try {
    if (session) {
      const [category] = await Category.create([{ ...data, slug, iconColor }], { session });
      return category;
    }
    return await Category.create({ ...data, slug, iconColor });
  } catch (error) {
    return rethrowCategoryWriteError(error);
  }
};

export const updateCategory = async (id: string, data: CategoryInput) => {
  ensureValidId(id);
  await Category.init();
  const category = await Category.findOne({ _id: id });
  if (!category) throw new AppError("Không tìm thấy danh mục", 404);

  const slug = data.slug || (data.name ? slugify(data.name) : undefined);
  if (slug) {
    await ensureUniqueSlug(slug, id);
    data.slug = slug;
  }

  const iconColor = await resolveUniqueIconColor(
    data.iconColor === undefined ? category.iconColor : data.iconColor,
    id,
  );
  Object.assign(category, { isActive: category.isActive && !category.isDeleted }, data, { iconColor, isDeleted: false, deletedAt: null });
  try {
    return await category.save();
  } catch (error) {
    return rethrowCategoryWriteError(error);
  }
};

export const deleteCategory = async (id: string) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id });
  if (!category) throw new AppError("Không tìm thấy danh mục", 404);

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
  const filter: QueryFilter<ICategory> = {
    $and: [catalogStatusFilter(query.isActive === undefined ? undefined : String(query.isActive))],
  };

  if (query.keyword?.trim()) {
    const keyword = query.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { slug: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ isDeleted: 1, isActive: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    items: items.map(item => catalogStatus(item.toObject())),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
