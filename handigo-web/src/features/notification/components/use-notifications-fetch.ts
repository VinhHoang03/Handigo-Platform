import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { notificationApi } from "../api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "../types/notification.types";
import { getNotificationErrorMessage } from "./notification-error";

type UseNotificationsFetchParams = {
  isAdmin: boolean;
  query: NotificationQuery;
  setQuery: Dispatch<SetStateAction<NotificationQuery>>;
  setItems: Dispatch<SetStateAction<AppNotification[]>>;
  setLoading: (value: boolean) => void;
  setLoadingMore: (value: boolean) => void;
  setTotalPages: (value: number) => void;
  setUnreadCount: (value: number) => void;
  setError: (value: string) => void;
};

/**
 * Gọi API danh sách/đếm thông báo + effect tự tải lại khi bộ lọc đổi.
 * Tách khỏi state chính để mỗi file điều phối không vượt giới hạn độ dài;
 * hành vi (thời điểm gọi API, debounce 150ms, cách gộp trang) giữ nguyên 100%.
 */
export function useNotificationsFetch({
  isAdmin,
  query,
  setQuery,
  setItems,
  setLoading,
  setLoadingMore,
  setTotalPages,
  setUnreadCount,
  setError,
}: UseNotificationsFetchParams) {
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const listResult = isAdmin
        ? await notificationApi.adminList(query)
        : await notificationApi.list(query);
      const countResult = isAdmin
        ? { count: listResult.items.filter((item) => !item.isRead).length }
        : await notificationApi.unreadCount();
      setItems(listResult.items);
      setTotalPages(listResult.pagination.totalPages || 1);
      setUnreadCount(countResult.count);
    } catch (err) {
      setError(getNotificationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    isAdmin,
    query,
    setError,
    setItems,
    setLoading,
    setTotalPages,
    setUnreadCount,
  ]);

  const loadUserNotifications = useCallback(
    async (nextQuery: NotificationQuery, append = false) => {
      if (isAdmin) return;

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
        setError(getNotificationErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      isAdmin,
      setError,
      setItems,
      setLoading,
      setLoadingMore,
      setTotalPages,
      setUnreadCount,
    ],
  );

  useEffect(() => {
    if (!isAdmin) return undefined;

    const timer = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timer);
  }, [isAdmin, load]);

  useEffect(() => {
    if (isAdmin) return undefined;

    const nextQuery: NotificationQuery = {
      page: 1,
      limit: query.limit,
      type: query.type,
      isRead: query.isRead,
      targetRole: query.targetRole,
    };
    const timer = window.setTimeout(() => {
      setQuery(nextQuery);
      void loadUserNotifications(nextQuery, false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    isAdmin,
    loadUserNotifications,
    query.isRead,
    query.limit,
    query.targetRole,
    query.type,
    setQuery,
  ]);

  return { load, loadUserNotifications };
}
