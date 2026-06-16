import { QueryFilter } from "mongoose";
import { Category, ICategory } from "../models/category.model";
import { AppError } from "../utils/appError";

const CATEGORY_FIELDS =
  "name slug description icon isActive createdAt updatedAt";

export type CreateCategoryInput = {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export type CategoryQuery = {
  keyword?: string;
  isActive?: "true" | "false";
  page?: number;
  limit?: number;
};

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

export const getActiveCategories = async () => {
  return Category.find().select(CATEGORY_FIELDS).sort({ name: 1 });
};

const ensureUniqueSlug = async (slug: string, excludedId?: string) => {
  const existing = await Category.findOne({
    slug,
    ...(excludedId ? { _id: { $ne: excludedId } } : {}),
  });

  if (existing) {
    throw new AppError("Category slug already exists", 409);
  }
};

export const getCategories = async (query: CategoryQuery = {}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: QueryFilter<ICategory> = { isDeleted: false };

  if (query.keyword) {
    const escapedKeyword = query.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keyword = new RegExp(escapedKeyword, "i");
    filter.$or = [
      { name: keyword },
      { slug: keyword },
      { description: keyword },
    ];
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .select(CATEGORY_FIELDS)
      .sort({ name: 1 })
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

export const getCategoryById = async (categoryId: string) => {
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  }).select(CATEGORY_FIELDS);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  return category;
};

export const createCategory = async (payload: CreateCategoryInput) => {
  const slug = normalizeSlug(payload.slug);
  await ensureUniqueSlug(slug);
  const category = await Category.create({
    name: payload.name,
    slug,
    description: payload.description ?? null,
    icon: payload.icon ?? null,
    isActive: payload.isActive ?? true,
  });

  return getCategoryById(category.id);
};

export const updateCategory = async (
  categoryId: string,
  payload: UpdateCategoryInput,
) => {
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (payload.name !== undefined) category.name = payload.name;
  if (payload.description !== undefined)
    category.description = payload.description;
  if (payload.icon !== undefined) category.icon = payload.icon;
  if (payload.isActive !== undefined) category.isActive = payload.isActive;

  if (payload.slug !== undefined) {
    const slug = normalizeSlug(payload.slug);
    await ensureUniqueSlug(slug, categoryId);
    category.slug = slug;
  }

  await category.save();
  return getCategoryById(categoryId);
};

export const deleteCategory = async (categoryId: string) => {
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  category.isDeleted = true;
  category.deletedAt = new Date();
  category.isActive = false;
  await category.save();
};
