import { Category } from "../models/category.model";

export const getActiveCategories = async () => {
  return Category.find({
    isActive: true,
    isDeleted: false,
  })
    .select("name slug icon isActive sortOrder")
    .sort({ sortOrder: 1, name: 1 });
};
