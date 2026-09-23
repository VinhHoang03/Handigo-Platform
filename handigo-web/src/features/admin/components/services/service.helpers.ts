import type {
  Service,
  ServiceOptionPayload,
  ServiceOptionSelectionMode,
  ServiceOptionType,
  ServicePayload,
} from '../../types/categoryService.types';

export const serviceMoney = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export const isImageUrl = (value: string | null | undefined) => /^https?:\/\//i.test(value ?? '');

export const getCategoryId = (service: Service) =>
  typeof service.categoryId === 'string' ? service.categoryId : service.categoryId?._id ?? '';

export const OPTION_TYPE_LABELS: Record<ServiceOptionType, string> = {
  room_count: 'Theo số phòng',
  area_size: 'Theo diện tích',
  package: 'Gói dịch vụ',
  add_on: 'Dịch vụ thêm',
  other: 'Khác',
};

export type ServiceForm = {
  categoryId: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice: string;
  depositAmount: string;
  requiresOptionSelection: boolean;
  isActive: boolean;
};

export const emptyServiceForm: ServiceForm = {
  categoryId: '',
  name: '',
  slug: '',
  image: '',
  description: '',
  serviceType: 'fixed_price',
  fixedPrice: '',
  depositAmount: '',
  requiresOptionSelection: false,
  isActive: true,
};

export type OptionForm = {
  name: string;
  description: string;
  image: string;
  optionType: ServiceOptionType;
  price: string;
  selectionGroup: string;
  selectionMode: ServiceOptionSelectionMode;
  allowsQuantity: boolean;
  sortOrder: string;
  isActive: boolean;
};

export const emptyOptionForm: OptionForm = {
  name: '',
  description: '',
  image: '',
  optionType: 'other',
  price: '',
  selectionGroup: '',
  selectionMode: 'multiple',
  allowsQuantity: false,
  sortOrder: '0',
  isActive: true,
};

export const toOptionPayload = (form: OptionForm, serviceType: Service['serviceType']): ServiceOptionPayload => ({
  name: form.name.trim(),
  description: form.description.trim() || undefined,
  image: form.image.trim() || undefined,
  optionType: form.optionType,
  price: serviceType === 'variable_price' ? 0 : Number(form.price) || 0,
  selectionGroup: form.selectionGroup.trim() || null,
  selectionMode: form.selectionMode,
  allowsQuantity: form.allowsQuantity,
  sortOrder: Number(form.sortOrder) || 0,
  isActive: form.isActive,
});

export const toServicePayload = (form: ServiceForm): ServicePayload => ({
  categoryId: form.categoryId,
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  image: form.image.trim() || undefined,
  description: form.description.trim() || undefined,
  serviceType: form.serviceType,
  fixedPrice: null,
  depositAmount: form.serviceType === 'variable_price' ? Number(form.depositAmount) : null,
  requiresOptionSelection: form.serviceType === 'fixed_price' ? true : form.requiresOptionSelection,
  isActive: form.isActive,
});

export const getPriceLabel = (service: Service) =>
  service.serviceType === 'variable_price' ? 'Giá linh hoạt' : 'Theo tùy chọn';
