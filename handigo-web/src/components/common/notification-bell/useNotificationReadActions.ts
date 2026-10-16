import type { Dispatch, SetStateAction } from "react";
import { notificationApi } from "@/features/notification/api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "@/features/notification/types/notification.types";
import { getErrorMessage, isNotificationForUser } from "./notificationBell.utils";

interface UseNotificationReadActionsParams {
  accountId: string;
  isCurrentAccount: () => boolean;
  isReadFilter: NotificationQuery["isRead"];
  setItems: Dispatch<SetStateAction<AppNotification[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string>>;
}

/** Đánh dấu một hoặc toàn bộ thông báo là đã đọc. */
export function useNotificationReadActions({
  accountId,
  isCurrentAccount,
  isReadFilter,
  setItems,
  setUnreadCount,
  setError,
}: UseNotificationReadActionsParams) {
  const markAsRead = async (item: AppNotification) => {
    if (!isCurrentAccount() || !isNotificationForUser(item, accountId)) return;

    try {
      const latest = await notificationApi.markAsRead(item.id);
      if (!isCurrentAccount()) return;
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? latest
            : notification,
        ),
      );
      if (!item.isRead) setUnreadCount((current) => Math.max(current - 1, 0));
      if (isReadFilter === false) {
        setItems((current) =>
          current.filter((notification) => notification.id !== item.id),
        );
      }
      return latest;
    } catch (err) {
      if (isCurrentAccount()) setError(getErrorMessage(err));
    }
  };

  const markAll = async () => {
    if (!isCurrentAccount()) return;
    try {
      await notificationApi.markAllAsRead();
      if (!isCurrentAccount()) return;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err) {
      if (isCurrentAccount()) setError(getErrorMessage(err));
    }
  };

  return { markAsRead, markAll };
}
