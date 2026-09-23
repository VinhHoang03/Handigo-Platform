import { useCallback, useEffect, useRef, useState } from "react";
import { notificationApi } from "@/features/notification/api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "@/features/notification/types/notification.types";
import type { AppRole } from "../Navbar";
import { getErrorMessage, getNotificationPath } from "./notificationBell.utils";
import { useNotificationReadActions } from "./useNotificationReadActions";
import { useNotificationSocket } from "./useNotificationSocket";

interface UseNotificationFeedOptions {
  /** Gọi khi có thông báo yêu cầu chọn kỹ thuật viên khác (chỉ áp dụng cho CUSTOMER). */
  onReassignmentRequired: (orderId: string, expiresAt?: string) => void;
}

/** Danh sách thông báo: tải, lọc, phân trang, đánh dấu đã đọc, đồng bộ qua socket. */
export function useNotificationFeed(
  role: AppRole | undefined,
  { onReassignmentRequired }: UseNotificationFeedOptions,
) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [query, setQuery] = useState<NotificationQuery>({
    page: 1,
    limit: 6,
    isRead: "",
  });
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const queryRef = useRef(query);
  const notificationPath = getNotificationPath(role);
  const canUseUserNotifications = role === "CUSTOMER" || role === "PROVIDER";

  const { markAsRead, markAll } = useNotificationReadActions({
    isReadFilter: query.isRead,
    setItems,
    setUnreadCount,
    setError,
  });

  const load = useCallback(
    async (nextQuery: NotificationQuery = query, append = false) => {
      if (!canUseUserNotifications) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const [listResult, countResult] = await Promise.all([
          notificationApi.list(nextQuery),
          notificationApi.unreadCount(),
        ]);
        setItems((current) =>
          append ? [...current, ...listResult.items] : listResult.items,
        );
        setTotalPages(listResult.pagination.totalPages || 1);
        setUnreadCount(countResult.count);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [canUseUserNotifications, query],
  );

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const handleIncomingNotification = useCallback(
    (notification: AppNotification) => {
      setUnreadCount((current) => current + 1);

      const currentQuery = queryRef.current;
      if (currentQuery.isRead === true) return;

      setItems((current) => {
        if (current.some((item) => item.id === notification.id)) return current;
        return [notification, ...current].slice(0, 20);
      });

      if (
        role === "CUSTOMER" &&
        notification.data?.action === "order_reassignment_required" &&
        typeof notification.data.orderId === "string"
      ) {
        onReassignmentRequired(
          notification.data.orderId,
          typeof notification.data.expiresAt === "string"
            ? notification.data.expiresAt
            : undefined,
        );
      }
    },
    [role, onReassignmentRequired],
  );

  useNotificationSocket(canUseUserNotifications, handleIncomingNotification);

  const clearUnreadBadge = async () => {
    setUnreadCount(0);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || new Date().toISOString(),
      })),
    );

    try {
      await notificationApi.markAllAsRead();
      await load({ ...queryRef.current, page: 1 }, false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      if (unreadCount > 0) {
        void clearUnreadBadge();
        return;
      }

      void load();
    }
  };

  const changeUnreadFilter = (isRead: NotificationQuery["isRead"]) => {
    const nextQuery = { ...query, page: 1, isRead };
    setQuery(nextQuery);
    void load(nextQuery, false);
  };

  const loadMore = () => {
    if ((query.page || 1) >= totalPages) return;

    const nextQuery = { ...query, page: (query.page || 1) + 1 };
    setQuery(nextQuery);
    void load(nextQuery, true);
  };

  return {
    open,
    setOpen,
    items,
    query,
    totalPages,
    unreadCount,
    loading,
    loadingMore,
    error,
    notificationPath,
    canUseUserNotifications,
    toggleOpen,
    changeUnreadFilter,
    loadMore,
    markAsRead,
    markAll,
  };
}
