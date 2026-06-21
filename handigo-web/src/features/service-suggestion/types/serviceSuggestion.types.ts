import type { Category, Service } from "@/features/admin/types/categoryService.types";

export type SuggestionType = "service" | "category";
export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface ProviderSummary {
  _id: string;
  userId?: string | {
    _id: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
  verified?: boolean;
  mainServiceText?: string | null;
}

export interface ReviewerSummary {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export interface ServiceSuggestion {
  _id: string;
  providerId: string | ProviderSummary;
  suggestionType: SuggestionType;
  suggestedServiceName?: string | null;
  suggestedCategoryName?: string | null;
  categoryId?: string | Pick<Category, "_id" | "name" | "slug" | "isActive"> | null;
  description?: string | null;
  status: SuggestionStatus;
  reviewedBy?: string | ReviewerSummary | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdServiceId?: string | Pick<Service, "_id" | "name" | "slug" | "categoryId" | "isActive"> | null;
  createdCategoryId?: string | Pick<Category, "_id" | "name" | "slug" | "isActive"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceSuggestionPayload {
  suggestionType: SuggestionType;
  suggestedServiceName?: string | null;
  suggestedCategoryName?: string | null;
  categoryId?: string | null;
  description?: string | null;
}

export interface UpdateServiceSuggestionPayload {
  status?: SuggestionStatus;
  adminNote?: string | null;
  categoryId?: string | null;
  createdServiceId?: string | null;
  createdCategoryId?: string | null;
}

export interface ServiceSuggestionQuery {
  status?: SuggestionStatus | "";
  suggestionType?: SuggestionType | "";
  providerId?: string;
  page?: number;
  limit?: number;
}

export interface ServiceSuggestionListResult {
  items: ServiceSuggestion[];
  total: number;
  page: number;
  limit: number;
}
