import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { notificationApi } from "../api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "../types/notification.types";
import { getNotificationErrorMessage } from "./notification-error";
import { isNotificationForUser } from "@/components/common/notification-bell/notificationBell.utils";

type UseNotificationsFetchParams = {
  accountId: string;
  isCurrentAccount: () => boolean;
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
  accountId,
  isCurrentAccount,
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
    if (!isCurrentAccount()) return;
    setLoading(true);
    setError("");
    try {
      const listResult = await notificationApi.list(query);
      if (!isCurrentAccount()) return;
      const countResult = await notificationApi.unreadCount();
      if (!isCurrentAccount()) return;
      setItems(listResult.items.filter((item) => isNotificationForUser(item, accountId)));
      setTotalPages(listResult.pagination.totalPages || 1);
      setUnreadCount(countResult.count);
    } catch (err) {
      if (isCurrentAccount()) setError(getNotificationErrorMessage(err));
    } finally {
      if (isCurrentAccount()) setLoading(false);
    }
  }, [
    accountId,
    isCurrentAccount,
    query,
    setError,
    setItems,
    setLoading,
    setTotalPages,
    setUnreadCount,
  ]);

  const loadUserNotifications = useCallback(
    async (nextQuery: NotificationQuery, append = false) => {
      if (isAdmin || !isCurrentAccount()) return;

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
        if (!isCurrentAccount()) return;
        const ownItems = listResult.items.filter((item) => isNotificationForUser(item, accountId));
        setItems((current) =>
          append ? [...current, ...ownItems] : ownItems,
        );
        setTotalPages(listResult.pagination.totalPages || 1);
        setUnreadCount(countResult.count);
      } catch (err) {
        if (isCurrentAccount()) setError(getNotificationErrorMessage(err));
      } finally {
        if (isCurrentAccount()) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      accountId,
      isCurrentAccount,
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
