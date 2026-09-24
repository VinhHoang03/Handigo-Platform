import type { ServiceSuggestion, SuggestionType } from "../types/serviceSuggestion.types";

export const suggestionTypeLabel: Record<SuggestionType, string> = {
  service: "Service",
  category: "Category",
};

export const getSuggestionErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể xử lý đề xuất. Vui lòng thử lại.";
};

export const formatSuggestionDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const getSuggestionName = (suggestion: ServiceSuggestion) =>
  suggestion.suggestionType === "service"
    ? suggestion.suggestedServiceName || "Dịch vụ chưa đặt tên"
    : suggestion.suggestedCategoryName || "Danh mục chưa đặt tên";

export const getSuggestionProviderName = (suggestion: ServiceSuggestion) => {
  if (typeof suggestion.providerId === "string") return suggestion.providerId;
  const user = suggestion.providerId.userId;
  if (typeof user === "object" && user?.fullName) return user.fullName;
  return "Provider";
};
