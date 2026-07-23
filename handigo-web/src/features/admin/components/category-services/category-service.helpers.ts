import type { CategoryPayload, Service, ServicePayload } from '../../types/categoryService.types';

export const categoryServiceMoney = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export const isImageUrl = (value: string | null | undefined) => /^https?:\/\//i.test(value || '');

export const getServiceCategoryId = (service: Service) => {
  if (!service.categoryId) return '';
  return typeof service.categoryId === 'string' ? service.categoryId : service.categoryId._id;
};

export interface CategoryFormState {
  name: string;
  slug: string;
  icon: string;
  description: string;
  isActive: boolean;
}

export const emptyCategoryForm: CategoryFormState = { name: '', slug: '', icon: '', description: '', isActive: true };

export const toCategoryPayload = (form: CategoryFormState): CategoryPayload => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  icon: form.icon.trim() || undefined,
  description: form.description.trim() || undefined,
  isActive: form.isActive,
});

export interface ServiceFormState {
  name: string;
  slug: string;
  image: string;
  description: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice: string;
  depositAmount: string;
  isActive: boolean;
}

export const emptyServiceForm: ServiceFormState = {
  name: '',
  slug: '',
  image: '',
  description: '',
  serviceType: 'fixed_price',
  fixedPrice: '',
  depositAmount: '',
  isActive: true,
};

export const toServicePayload = (form: ServiceFormState, categoryId: string): ServicePayload => ({
  categoryId,
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  image: form.image.trim() || undefined,
  description: form.description.trim() || undefined,
  serviceType: form.serviceType,
  fixedPrice: null,
  depositAmount: form.serviceType === 'variable_price' && form.depositAmount ? Number(form.depositAmount) : null,
  isActive: form.isActive,
});
