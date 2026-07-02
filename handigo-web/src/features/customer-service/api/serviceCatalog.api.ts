import api from "@/api/client";
import { unwrap, type ListResponse } from "@/api/response";
import type { Category, Service, ServiceOption } from "@/types/booking";

export interface ServiceCatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  serviceType?: string;
  isActive?: string;
  bookedOnly?: string;
}

export const serviceCatalogApi = {
  categories: async () =>
    unwrap<Category[]>(await api.get("/categories/active")),

  services: async (query: ServiceCatalogQuery = {}) =>
    unwrap<ListResponse<Service>>(
      await api.get("/services", {
        params: { page: 1, limit: 100, isActive: "true", ...query },
      }),
    ),

  servicesByCategory: async (categoryId: string) => {
    const data = await serviceCatalogApi.services({ categoryId });
    return data.items;
  },

  serviceById: async (serviceId: string) =>
    unwrap<Service>(await api.get(`/services/${serviceId}`)),

  options: async (serviceId: string) =>
    unwrap<ServiceOption[]>(await api.get(`/services/${serviceId}/options`)),
};
