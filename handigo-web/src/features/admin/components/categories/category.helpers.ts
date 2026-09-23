import type { Category, CategoryPayload } from '../../types/categoryService.types';

/** Định dạng số liệu tổng dịch vụ trong bảng thống kê danh mục. */
export const categoryMoney = new Intl.NumberFormat('vi-VN');

export const formatCategoryDate = (date: string) =>
  new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export interface CategoryFormState {
  name: string;
  slug: string;
  icon: string;
  description: string;
  isActive: boolean;
}

export const emptyCategoryForm: CategoryFormState = {
  name: '',
  slug: '',
  icon: '',
  description: '',
  isActive: true,
};

export const toCategoryPayload = (form: CategoryFormState): CategoryPayload => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  icon: form.icon.trim() || undefined,
  description: form.description.trim() || undefined,
  isActive: form.isActive,
});

/** Gom số dịch vụ theo danh mục từ danh sách dịch vụ phẳng. */
export const countServicesByCategory = (
  services: Array<{ categoryId: string | { _id: string } | null }>,
) =>
  services.reduce<Record<string, number>>((acc, service) => {
    const categoryId = typeof service.categoryId === 'string' ? service.categoryId : service.categoryId?._id ?? '';
    if (categoryId) acc[categoryId] = (acc[categoryId] || 0) + 1;
    return acc;
  }, {});

export const countActiveCategories = (categories: Category[]) =>
  categories.filter((category) => category.isActive).length;
