import api from "@/api/client";
import type { Category, Service, ServiceOption } from "@/types/booking";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ListResponse<T> {
  items: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerServiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  serviceType?: string;
  isActive?: string;
  bookedOnly?: string;
}

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const customerServiceApi = {
  categories: async () =>
    unwrap<Category[]>(await api.get("/categories/active")),

  services: async (query: CustomerServiceQuery = {}) =>
    unwrap<ListResponse<Service>>(
      await api.get("/services", {
        params: { page: 1, limit: 100, isActive: "true", ...query },
      }),
    ),

  serviceById: async (serviceId: string) =>
    unwrap<Service>(await api.get(`/services/${serviceId}`)),

  options: async (serviceId: string) =>
    unwrap<ServiceOption[]>(await api.get(`/services/${serviceId}/options`)),
};
