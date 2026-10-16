import type {
  Service,
  ServiceOptionPayload,
  ServiceOptionSelectionMode,
  ServiceOptionType,
  ServicePayload,
} from '../../types/categoryService.types';
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import type { ServiceProcessStep } from '@/types/serviceProcess';

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
  coverImage: string;
  galleryImages: string[];
  description: string;
  processSteps: ServiceProcessStep[];
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
  coverImage: '',
  galleryImages: [],
  description: '',
  processSteps: [],
  serviceType: 'fixed_price',
  fixedPrice: '',
  depositAmount: '',
  requiresOptionSelection: false,
  isActive: true,
};

export type OptionForm = {
  groupId: string;
  name: string;
  description: string;
  image: string;
  optionType: ServiceOptionType;
  price: string;
  selectionGroup: string;
  selectionMode: ServiceOptionSelectionMode;
  allowsQuantity: boolean;
  isActive: boolean;
};

export const emptyOptionForm: OptionForm = {
  groupId: '',
  name: '',
  description: '',
  image: '',
  optionType: 'other',
  price: '',
  selectionGroup: '',
  selectionMode: 'multiple',
  allowsQuantity: false,
  isActive: true,
};

export const toOptionPayload = (form: OptionForm): ServiceOptionPayload => ({
  groupId: form.groupId || null,
  name: form.name.trim(),
  description: form.description.trim() || undefined,
  image: form.image.trim() || undefined,
  optionType: form.optionType,
  price: Number(form.price) || 0,
  selectionGroup: form.selectionGroup.trim() || null,
  selectionMode: form.selectionMode,
  allowsQuantity: form.allowsQuantity,
  isActive: form.isActive,
});

export const toServicePayload = (form: ServiceForm): ServicePayload => ({
  categoryId: form.categoryId,
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  coverImage: form.coverImage.trim() || null,
  galleryImages: form.galleryImages,
  description: form.description.trim() || undefined,
  processSteps: form.processSteps.map((step) => ({ title: step.title.trim(), description: step.description.trim() })),
  serviceType: form.serviceType,
  fixedPrice: form.fixedPrice === '' ? null : Number(form.fixedPrice),
  depositAmount: form.serviceType === 'variable_price' ? Number(form.depositAmount) : null,
  requiresOptionSelection: form.requiresOptionSelection,
  isActive: form.isActive,
});

export const getPriceLabel = (service: Service) =>
  isAirConditionerCleaning(service) ? `${serviceMoney.format(service.fixedPrice || 0)} / máy` : service.serviceType === 'variable_price' ? 'Giá linh hoạt' : 'Theo tùy chọn';
