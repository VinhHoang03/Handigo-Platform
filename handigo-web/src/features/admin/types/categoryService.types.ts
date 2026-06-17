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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  _id: string;
  categoryId: string | Pick<Category, '_id' | 'name' | 'slug' | 'isActive'> | null;
  name: string;
  slug: string;
  description?: string | null;
  serviceType: 'fixed_price' | 'variable_price';
  image?: string | null;
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
  isActive?: boolean;
}

export interface ServicePayload {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string | null;
  serviceType: 'fixed_price' | 'variable_price';
  image?: string | null;
  isActive?: boolean;
}

export type ServiceOptionType = "room_count" | "area_size" | "package" | "add_on" | "other";

export interface ServiceOption {
  _id: string;
  serviceId: string;
  name: string;
  optionType: ServiceOptionType;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOptionPayload {
  name: string;
  optionType: ServiceOptionType;
  price: number;
  isActive?: boolean;
}
