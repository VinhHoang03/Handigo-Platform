import type { ServiceProcessStep } from '@/types/serviceProcess';
import type { OptionGroupDefinition } from '@/types/booking';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  optionGroups?: OptionGroupDefinition[];
  _id: string;
  categoryId: string | Pick<Category, '_id' | 'name' | 'slug' | 'isActive'> | null;
  name: string;
  slug: string;
  description?: string | null;
  processSteps?: ServiceProcessStep[];
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice?: number | null;
  minOptionPrice?: number | null;
  depositAmount?: number | null;
  coverImage?: string | null;
  galleryImages?: string[];
  image?: string | null;
  requiresOptionSelection: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDetail extends Category {
  services: Service[];
}

export interface ListResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface CategoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
}

export interface ServiceQuery extends CategoryQuery {
  categoryId?: string;
  serviceType?: string;
}

export interface CategoryPayload {
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  isActive?: boolean;
}

export interface ServicePayload {
  optionGroups?: OptionGroupDefinition[];
  categoryId: string;
  name: string;
  slug?: string;
  description?: string | null;
  processSteps?: ServiceProcessStep[];
  serviceType: 'fixed_price' | 'variable_price';
  fixedPrice?: number | null;
  depositAmount?: number | null;
  coverImage?: string | null;
  galleryImages?: string[];
  image?: string | null;
  requiresOptionSelection?: boolean;
  isActive?: boolean;
}

export type ServiceOptionType = "room_count" | "area_size" | "package" | "add_on" | "other";
export type ServiceOptionSelectionMode = "single" | "multiple";

export interface ServiceOption {
  groupId?: string | null;
  isRequired?: boolean;
  _id: string;
  serviceId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  optionType: ServiceOptionType;
  price: number;
  selectionGroup?: string | null;
  selectionMode?: ServiceOptionSelectionMode;
  allowsQuantity?: boolean;
  sortOrder?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOptionPayload {
  groupId?: string | null;
  name: string;
  description?: string | null;
  image?: string | null;
  optionType: ServiceOptionType;
  price: number;
  selectionGroup?: string | null;
  selectionMode?: ServiceOptionSelectionMode;
  allowsQuantity?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}
