import type {
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

export const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Không tải được thông báo.";
};
