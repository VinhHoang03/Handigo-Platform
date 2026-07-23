import type { Dispatch, SetStateAction } from "react";
import { notificationApi } from "@/features/notification/api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "@/features/notification/types/notification.types";
import { getErrorMessage } from "./notificationBell.utils";

interface UseNotificationReadActionsParams {
  isReadFilter: NotificationQuery["isRead"];
  setItems: Dispatch<SetStateAction<AppNotification[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string>>;
}

/** Đánh dấu một hoặc toàn bộ thông báo là đã đọc. */
export function useNotificationReadActions({
  isReadFilter,
  setItems,
  setUnreadCount,
  setError,
}: UseNotificationReadActionsParams) {
  const markAsRead = async (item: AppNotification) => {
    if (item.isRead) return;

    try {
      await notificationApi.markAsRead(item.id);
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : notification,
        ),
      );
      setUnreadCount((current) => Math.max(current - 1, 0));
      if (isReadFilter === false) {
        setItems((current) =>
          current.filter((notification) => notification.id !== item.id),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return { markAsRead, markAll };
}
