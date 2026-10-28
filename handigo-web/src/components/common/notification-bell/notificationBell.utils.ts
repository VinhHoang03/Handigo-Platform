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

export const isNotificationForUser = (item: AppNotification, userId: string) => {
  const recipientId = typeof item.userId === "string"
    ? item.userId
    : item.userId?.id || item.userId?._id;
  return Boolean(userId) && recipientId === userId;
};

export const getNotificationUnavailableReason = (item: AppNotification) => {
  if (item.data?.orderUnavailable !== true) return null;
  return typeof item.data.orderUnavailableReason === "string"
    ? item.data.orderUnavailableReason
    : "Bạn không còn phụ trách đơn hàng này.";
};

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
  if (getNotificationUnavailableReason(item)) return null;
  const actionUrl = getDataString(item, "actionUrl");
  const orderId = getDataString(item, "orderId");
  const isWithdrawal = item.type === "WITHDRAWAL" || Boolean(getDataString(item, "withdrawalId"));
  // Thông báo cũ về ví có thể chỉ lưu orderId/paymentId và nội dung mô tả.
  const mentionsWallet = /(?:^|\s)ví(?:\s|[.,!?;:]|$)/iu.test(
    `${item.title ?? ""} ${item.content ?? ""}`.normalize("NFC"),
  );
  const isWalletPayment = item.type === "PAYMENT" && Boolean(
    getDataString(item, "transactionId") || getDataString(item, "walletId")
      || getDataString(item, "refundChannel") === "handigo_wallet"
      || getDataString(item, "destination") === "handigo_wallet"
      || !orderId,
  );
  if (isWithdrawal || isWalletPayment || mentionsWallet) {
    const walletPath = role === "CUSTOMER" ? "/customer/wallet"
      : role === "PROVIDER" ? "/provider/wallet"
        : role === "ADMIN" ? isWithdrawal ? "/admin/withdrawals" : "/admin/wallets"
          : null;
    if (walletPath) {
      if (actionUrl?.split(/[?#]/)[0] === walletPath) return actionUrl;
      return walletPath;
    }
  }

  const assignmentId = getDataString(item, "assignmentId");
  if (role === "PROVIDER" && assignmentId && orderId) {
    return `/provider/orders?assignmentId=${encodeURIComponent(assignmentId)}&orderId=${encodeURIComponent(orderId)}`;
  }

  if (actionUrl && isInternalPath(actionUrl)) return actionUrl;

  if (orderId) {
    if (role === "CUSTOMER") return `/customer/bookings/${orderId}`;
    if (role === "PROVIDER") return `/provider/orders/${orderId}`;
    if (role === "ADMIN") return `/admin/payments?orderId=${orderId}`;
  }

  const serviceId = getDataString(item, "serviceId");
  if (serviceId && role === "CUSTOMER") {
    return `/customer/services/${serviceId}`;
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
