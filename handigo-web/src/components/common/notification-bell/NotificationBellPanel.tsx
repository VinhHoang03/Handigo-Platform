import type {
  AppNotification,
  NotificationQuery,
} from "@/features/notification/types/notification.types";
import { NotificationItem } from "./NotificationItem";
import { ChevronDown } from "lucide-react";

interface NotificationBellPanelProps {
  unreadCount: number;
  isReadFilter: NotificationQuery["isRead"];
  onChangeFilter: (isRead: NotificationQuery["isRead"]) => void;
  onMarkAll: () => void;
  loading: boolean;
  error: string;
  items: AppNotification[];
  onMarkAsRead: (item: AppNotification) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/** Bảng thả xuống của chuông thông báo: bộ lọc, danh sách, phân trang. */
export function NotificationBellPanel({
  unreadCount,
  isReadFilter,
  onChangeFilter,
  onMarkAll,
  loading,
  error,
  items,
  onMarkAsRead,
  hasMore,
  loadingMore,
  onLoadMore,
}: NotificationBellPanelProps) {
  return (
    <div className="absolute right-0 z-[80] mt-3 w-[calc(100vw-32px)] max-w-[380px] overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_48px_rgba(19,27,46,0.18)]">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
        <div>
          <p className="font-bold text-on-surface">Thông báo</p>
          <p className="text-xs text-on-surface-variant">
            {unreadCount} thông báo chưa đọc
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkAll}
          disabled={unreadCount === 0}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-on-surface-variant"
        >
          Đọc tất cả
        </button>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/20 px-4 py-3">
        <button
          type="button"
          onClick={() => onChangeFilter("")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            isReadFilter === ""
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface-variant hover:text-primary"
          }`}
        >
          Tất cả
        </button>
        <button
          type="button"
          onClick={() => onChangeFilter(false)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            isReadFilter === false
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
          <NotificationItem key={item.id} item={item} onMarkAsRead={onMarkAsRead} />
        ))}
      </div>

      <div className="border-t border-outline-variant/20 px-4 py-3 text-center">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-on-surface-variant"
          >
            <ChevronDown aria-hidden="true" size={18} />
            {loadingMore ? "Đang tải..." : "Xem thông báo trước đó"}
          </button>
        ) : (
          <span className="text-xs text-on-surface-variant">
            Đã hiển thị toàn bộ thông báo.
          </span>
        )}
      </div>
    </div>
  );
}
