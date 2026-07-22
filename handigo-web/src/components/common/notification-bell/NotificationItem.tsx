import type { AppNotification } from "@/features/notification/types/notification.types";
import { dateTime, typeIcons } from "./notificationBell.utils";

interface NotificationItemProps {
  item: AppNotification;
  onMarkAsRead: (item: AppNotification) => void;
}

/** Một dòng thông báo trong danh sách thả xuống. */
export function NotificationItem({ item, onMarkAsRead }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onMarkAsRead(item)}
      className={`flex w-full gap-3 border-b border-outline-variant/10 px-4 py-3 text-left transition hover:bg-surface-container-low ${
        item.isRead ? "bg-surface-container-lowest" : "bg-primary/5"
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
  );
}
