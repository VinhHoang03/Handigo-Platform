import type {
  AppNotification,
  NotificationType,
} from "@/features/notification/types/notification.types";
import type { AppRole } from "../Navbar";
import { Banknote, FileSpreadsheet, type LucideIcon, Megaphone, ReceiptText, Tag, Wallet } from "lucide-react";

export const typeIcons: Record<NotificationType, LucideIcon> = {
  ORDER: ReceiptText,
  PAYMENT: Banknote,
  QUOTATION: FileSpreadsheet,
  WITHDRAWAL: Wallet,
  PROMOTION: Tag,
  SYSTEM: Megaphone,
};

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const getNotificationPath = (role?: AppRole) => {
  if (role === "ADMIN") return "/admin/notifications";
  return "#";
};

const getDataString = (item: AppNotification, key: string) => {
  const value = item.data?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
};

const isInternalPath = (value: string) =>
  value.startsWith("/") && !value.startsWith("//");

export const getNotificationTarget = (
  item: AppNotification,
  role?: AppRole,
) => {
  const actionUrl = getDataString(item, "actionUrl");
  if (actionUrl && isInternalPath(actionUrl)) return actionUrl;

  const orderId = getDataString(item, "orderId");
  if (orderId) {
    if (role === "CUSTOMER") return `/customer/bookings/${orderId}`;
    if (role === "PROVIDER") return `/provider/orders/${orderId}`;
    if (role === "ADMIN") return `/admin/payments?orderId=${orderId}`;
  }

  const serviceId = getDataString(item, "serviceId");
  if (serviceId && role === "CUSTOMER") {
    return `/customer/services/${serviceId}`;
  }

  if (getDataString(item, "withdrawalId") && role === "ADMIN") {
    return "/admin/withdrawals";
  }

  if (getDataString(item, "providerApplicationId") && role === "ADMIN") {
    return "/admin/provider-applications";
  }

  return null;
};

export const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Không tải được thông báo.";
};
