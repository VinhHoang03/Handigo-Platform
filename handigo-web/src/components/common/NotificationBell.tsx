import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import { notificationApi } from "@/features/notification/api/notification.api";
import type {
  AppNotification,
  NotificationQuery,
  NotificationType,
} from "@/features/notification/types/notification.types";
import type { AppRole } from "./Navbar";
import { Modal } from "./Modal";
import { bookingApi } from "@/features/booking/api/booking.api";

const typeIcons: Record<NotificationType, string> = {
  ORDER: "receipt_long",
  PAYMENT: "payments",
  QUOTATION: "request_quote",
  WITHDRAWAL: "account_balance_wallet",
  PROMOTION: "local_offer",
  SYSTEM: "campaign",
};

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const getNotificationPath = (role?: AppRole) => {
  if (role === "ADMIN") return "/admin/notifications";
  return "#";
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Không tải được thông báo.";
};

export function NotificationBell({ role }: { role?: AppRole }) {
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
  const [reassignmentAction, setReassignmentAction] = useState<{
    orderId: string;
    expiresAt?: string;
  } | null>(null);
  const [reassignmentBusy, setReassignmentBusy] = useState(false);
  const [reassignmentError, setReassignmentError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  const notificationPath = getNotificationPath(role);
  const canUseUserNotifications = role === "CUSTOMER" || role === "PROVIDER";

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

  useEffect(() => {
    if (!canUseUserNotifications) return undefined;

    const { socket, dispose } = createAuthenticatedSocket();

    const handleNewNotification = (notification: AppNotification) => {
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
        setReassignmentError("");
        setReassignmentAction({
          orderId: notification.data.orderId,
          expiresAt:
            typeof notification.data.expiresAt === "string"
              ? notification.data.expiresAt
              : undefined,
        });
      }
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      dispose();
    };
  }, [canUseUserNotifications, role]);

  const respondToReassignment = async (
    decision: "accept" | "decline",
  ) => {
    if (!reassignmentAction) return;
    try {
      setReassignmentBusy(true);
      setReassignmentError("");
      await bookingApi.respondToReassignment(
        reassignmentAction.orderId,
        decision,
      );
      setReassignmentAction(null);
    } catch (err) {
      setReassignmentError(getErrorMessage(err));
    } finally {
      setReassignmentBusy(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      if (query.isRead === false) {
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

  if (!canUseUserNotifications) {
    return (
      <Link
        to={notificationPath}
        aria-label="Thông báo"
        className="material-symbols-outlined hidden rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary sm:inline-flex"
      >
        notifications
      </Link>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
      >
        <span className="material-symbols-outlined text-[22px]">
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-error px-1.5 text-center text-[11px] font-bold leading-5 text-on-error">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[80] mt-3 w-[calc(100vw-32px)] max-w-[380px] overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-[0_18px_48px_rgba(19,27,46,0.18)]">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
            <div>
              <p className="font-bold text-on-surface">Thông báo</p>
              <p className="text-xs text-on-surface-variant">
                {unreadCount} thông báo chưa đọc
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unreadCount === 0}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-on-surface-variant"
            >
              Đọc tất cả
            </button>
          </div>

          <div className="flex gap-2 border-b border-outline-variant/20 px-4 py-3">
            <button
              type="button"
              onClick={() => changeUnreadFilter("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                query.isRead === ""
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:text-primary"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => changeUnreadFilter(false)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                query.isRead === false
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:text-primary"
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                Đang tải thông báo...
              </div>
            )}
            {error && items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-error">
                {error}
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                Chưa có thông báo.
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void markAsRead(item)}
                className={`flex w-full gap-3 border-b border-outline-variant/10 px-4 py-3 text-left transition hover:bg-surface-container-low ${
                  item.isRead ? "bg-white" : "bg-primary/5"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    item.isRead
                      ? "bg-surface-container-low text-on-surface-variant"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined block text-[20px] leading-none">
                    {typeIcons[item.type]}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 font-semibold text-on-surface">
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant">
                    {item.content}
                  </span>
                  <span className="mt-2 block text-xs text-on-surface-variant">
                    {dateTime.format(new Date(item.createdAt))}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-outline-variant/20 px-4 py-3 text-center">
            {(query.page || 1) < totalPages ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">
                  expand_more
                </span>
                {loadingMore ? "Đang tải..." : "Xem thông báo trước đó"}
              </button>
            ) : (
              <span className="text-xs text-on-surface-variant">
                Đã hiển thị toàn bộ thông báo.
              </span>
            )}
          </div>
        </div>
      )}

      {reassignmentAction && (
        <Modal
          open
          title="Bạn có muốn tìm kỹ thuật viên khác?"
          onClose={() => {
            if (!reassignmentBusy) setReassignmentAction(null);
          }}
          size="sm"
          closeOnEsc={!reassignmentBusy}
          closeOnOverlayClick={!reassignmentBusy}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-on-surface-variant">
              Kỹ thuật viên đã hủy đơn sau khi nhận. Handigo có thể giữ nguyên đơn và khoản thanh toán để tìm người thay thế. Nếu bạn từ chối, đơn sẽ được hủy và hoàn tiền theo phương thức đã thanh toán.
            </p>
            {reassignmentAction.expiresAt && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                Phản hồi trước {new Date(reassignmentAction.expiresAt).toLocaleString("vi-VN")}.
              </p>
            )}
            {reassignmentError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {reassignmentError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={reassignmentBusy}
                onClick={() => void respondToReassignment("decline")}
                className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-600 disabled:opacity-50"
              >
                Hủy đơn và hoàn tiền
              </button>
              <button
                type="button"
                disabled={reassignmentBusy}
                onClick={() => void respondToReassignment("accept")}
                className="rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50"
              >
                {reassignmentBusy ? "Đang xử lý..." : "Tìm kỹ thuật viên khác"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
