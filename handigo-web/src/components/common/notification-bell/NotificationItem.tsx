import type { AppNotification } from "@/features/notification/types/notification.types";
import { dateTime, getNotificationUnavailableReason, typeIcons } from "./notificationBell.utils";

interface NotificationItemProps {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
}

/** Một dòng thông báo trong danh sách thả xuống. */
export function NotificationItem({ item, onOpen }: NotificationItemProps) {
  const unavailableReason = getNotificationUnavailableReason(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`flex w-full gap-3 border-b border-outline-variant/10 px-4 py-3 text-left transition hover:bg-surface-container-low ${
        unavailableReason ? "bg-surface-container-low" : item.isRead ? "bg-surface-container-lowest" : "bg-primary/5"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          item.isRead || unavailableReason
            ? "bg-surface-container-low text-on-surface-variant"
            : "bg-primary/10 text-primary"
        }`}
      >
        {(() => {
          const TypeIcon = typeIcons[item.type];
          return <TypeIcon aria-hidden="true" size={20} className="block" />;
        })()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`line-clamp-1 font-semibold ${unavailableReason ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
            {item.title}
          </span>
          {!item.isRead && !unavailableReason && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </span>
        <span className="mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant">
          {item.content}
        </span>
        {unavailableReason && (
          <span className="mt-2 block text-xs text-on-surface-variant">
            <span className="mr-1 rounded bg-surface-container-high px-1.5 py-0.5 font-semibold">Không còn hiệu lực</span>
            {unavailableReason}
          </span>
        )}
        <span className="mt-2 block text-xs text-on-surface-variant">
          {dateTime.format(new Date(item.createdAt))}
        </span>
      </span>
    </button>
  );
}
