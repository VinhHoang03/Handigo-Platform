import { useMemo, useState, type FormEvent } from "react";
import { notificationApi } from "../api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
} from "../types/notification.types";
import { getNotificationErrorMessage } from "./notification-error";
import type { SendFormState } from "./SendNotificationModal";
import { useNotificationsFetch } from "./use-notifications-fetch";
import { Bell, Inbox, MailOpen } from "lucide-react";

export type NotificationRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

const emptySendForm: SendFormState = {
  targetRole: "ALL",
  title: "",
  content: "",
};

/**
 * Toàn bộ state, gọi API, và xử lý hành vi của trang Thông báo.
 * Tách ra khỏi component để trang chỉ còn lo bố cục — không đổi hành vi gốc.
 */
export function useNotificationsPageController(role: NotificationRole) {
  const [query, setQuery] = useState<NotificationQuery>({
    page: 1,
    limit: 8,
    type: "",
    isRead: "",
    targetRole: "",
  });
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState<SendFormState>(emptySendForm);

  const isAdmin = role === "ADMIN";

  const { load, loadUserNotifications } = useNotificationsFetch({
    isAdmin,
    query,
    setQuery,
    setItems,
    setLoading,
    setLoadingMore,
    setTotalPages,
    setUnreadCount,
    setError,
  });

  const stats = useMemo(() => {
    const readOnPage = items.filter((item) => item.isRead).length;
    return [
      { icon: Bell, label: "Chưa đọc", value: unreadCount },
      { icon: MailOpen, label: "Đã đọc trên trang", value: readOnPage },
      { icon: Inbox, label: "Tổng trên trang", value: items.length },
    ];
  }, [items, unreadCount]);

  const refresh = async () => {
    if (isAdmin) {
      await load();
      return;
    }

    const nextQuery = { ...query, page: 1 };
    setQuery(nextQuery);
    await loadUserNotifications(nextQuery, false);
  };

  const loadMore = async () => {
    if (isAdmin || (query.page || 1) >= totalPages) return;

    const nextQuery = { ...query, page: (query.page || 1) + 1 };
    setQuery(nextQuery);
    await loadUserNotifications(nextQuery, true);
  };

  const markOne = async (notification: AppNotification) => {
    if (notification.isRead) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await notificationApi.markAsRead(notification.id);
      setNotice("Đã đánh dấu thông báo là đã đọc.");
      await refresh();
    } catch (err) {
      setError(getNotificationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await notificationApi.markAllAsRead();
      setNotice(`Đã đánh dấu ${result.modifiedCount} thông báo là đã đọc.`);
      await refresh();
    } catch (err) {
      setError(getNotificationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSystemNotification = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await notificationApi.sendSystem({
        targetRole: sendForm.targetRole,
        title: sendForm.title.trim(),
        content: sendForm.content.trim(),
        type: "SYSTEM",
      });
      setSendOpen(false);
      setSendForm(emptySendForm);
      setNotice(
        `Đã gửi thông báo hệ thống tới ${result.sentCount} người dùng.`,
      );
      await load();
    } catch (err) {
      setError(getNotificationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    isAdmin,
    query,
    setQuery,
    items,
    loadingMore,
    totalPages,
    unreadCount,
    loading,
    error,
    notice,
    busy,
    sendOpen,
    setSendOpen,
    sendForm,
    setSendForm,
    stats,
    refresh,
    loadMore,
    markOne,
    markAll,
    submitSystemNotification,
  };
}
