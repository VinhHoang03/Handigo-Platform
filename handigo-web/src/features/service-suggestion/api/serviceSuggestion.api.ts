import api from "@/api/client";
import { unwrap } from "@/api/response";
import type {
  CreateServiceSuggestionPayload,
  ServiceSuggestion,
  ServiceSuggestionListResult,
  ServiceSuggestionQuery,
  UpdateServiceSuggestionPayload,
} from "../types/serviceSuggestion.types";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}

export const serviceSuggestionApi = {
  create: async (payload: CreateServiceSuggestionPayload) =>
    unwrap<ServiceSuggestion>(await api.post("/service-suggestions", payload)),

  list: async (query: ServiceSuggestionQuery = {}) => {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== ""),
    );
    const response = await api.get<ApiResponse<ServiceSuggestion[]>>(
      "/service-suggestions",
      { params },
    );

    return {
      items: response.data.data,
      total: response.data.total || 0,
      page: response.data.page || query.page || 1,
      limit: response.data.limit || query.limit || 10,
    } satisfies ServiceSuggestionListResult;
  },

  update: async (id: string, payload: UpdateServiceSuggestionPayload) =>
    unwrap<ServiceSuggestion>(await api.patch(`/service-suggestions/${id}`, payload)),
};
