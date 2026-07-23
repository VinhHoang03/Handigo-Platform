import type { NotificationQuery } from "../types/notification.types";

/** Cặp nút lọc nhanh "Tất cả / Chưa đọc" dành cho trang thông báo khách hàng & nhà cung cấp. */
export function NotificationQuickFilters({
  query,
  unreadCount,
  onQueryChange,
}: {
  query: NotificationQuery;
  unreadCount: number;
  onQueryChange: (query: NotificationQuery) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onQueryChange({ ...query, isRead: "", page: 1 })}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          query.isRead === ""
            ? "bg-primary text-on-primary"
            : "bg-surface-container-low text-on-surface-variant hover:text-primary"
        }`}
      >
        Tất cả
      </button>
      <button
        type="button"
        onClick={() => onQueryChange({ ...query, isRead: false, page: 1 })}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          query.isRead === false
            ? "bg-primary text-on-primary"
            : "bg-surface-container-low text-on-surface-variant hover:text-primary"
        }`}
      >
        Chưa đọc ({unreadCount})
      </button>
    </div>
  );
}
