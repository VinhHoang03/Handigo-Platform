import { QueryFilter, Types } from "mongoose";
import { Category, ICategory } from "../models/category.model";
import { Service } from "../models/service.model";
import { AppError } from "../utils/appError";

interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
}

interface ListCategoriesQuery {
  page?: string;
  limit?: string;
  search?: string;
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
  const slug = data.slug || slugify(data.name || "");
  if (!slug) throw new AppError("Unable to generate a valid slug", 400);
  await ensureUniqueSlug(slug);
  return Category.create({ ...data, slug });
};

export const updateCategory = async (id: string, data: CategoryInput) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new AppError("Category not found", 404);

  const slug = data.slug || (data.name ? slugify(data.name) : undefined);
  if (slug) {
    await ensureUniqueSlug(slug, id);
    data.slug = slug;
  }

  Object.assign(category, data);
  return category.save();
};

export const deleteCategory = async (id: string) => {
  ensureValidId(id);
  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) throw new AppError("Category not found", 404);

  const hasServices = await Service.exists({ categoryId: id, isDeleted: false });
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
    .select("name slug icon isActive sortOrder")
    .sort({ sortOrder: 1, name: 1 });
};
