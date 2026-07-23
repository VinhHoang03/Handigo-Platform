import type {
  NotificationType,
} from "@/features/notification/types/notification.types";
import type { AppRole } from "../Navbar";

export const typeIcons: Record<NotificationType, string> = {
  ORDER: "receipt_long",
  PAYMENT: "payments",
  QUOTATION: "request_quote",
  WITHDRAWAL: "account_balance_wallet",
  PROMOTION: "local_offer",
  SYSTEM: "campaign",
};

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const getNotificationPath = (role?: AppRole) => {
  if (role === "ADMIN") return "/admin/notifications";
  return "#";
};

export const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Không tải được thông báo.";
};
