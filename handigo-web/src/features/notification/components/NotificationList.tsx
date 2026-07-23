import type { AppNotification } from "../types/notification.types";
import {
  notificationTypeIcons,
  notificationTypeLabels,
} from "./notification-type-meta";
import { Check } from "lucide-react";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export function NotificationList({
  items,
  busy,
  showRecipient,
  onMarkRead,
}: {
  items: AppNotification[];
  busy: boolean;
  showRecipient?: boolean;
  onMarkRead: (notification: AppNotification) => void;
}) {
  return (
    <div className="divide-y divide-outline-variant/10">
      {items.map((item) => (
        <NotificationListItem
          key={item.id}
          item={item}
          busy={busy}
          showRecipient={showRecipient}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}

function NotificationListItem({
  item,
  busy,
  showRecipient,
  onMarkRead,
}: {
  item: AppNotification;
  busy: boolean;
  showRecipient?: boolean;
  onMarkRead: (notification: AppNotification) => void;
}) {
  return (
    <article
      className={`flex gap-4 py-4 ${item.isRead ? "" : "bg-primary/5 px-3 sm:-mx-3"}`}
    >
      <span
        className={`mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.isRead ? "bg-surface-container-low text-on-surface-variant" : "bg-primary/10 text-primary"}`}
      >
        <span className="material-symbols-outlined block text-[24px] leading-none">
          {notificationTypeIcons[item.type]}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-on-surface">{item.title}</h3>
              <span className="inline-flex rounded-full bg-surface-container-low px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                {notificationTypeLabels[item.type]}
              </span>
              {!item.isRead && (
                <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                  Mới
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              {item.content}
            </p>
            {showRecipient && item.recipient && (
              <p className="mt-2 text-sm text-on-surface-variant">
                Người nhận:{" "}
                <span className="font-semibold text-on-surface">
                  {item.recipient.fullName ||
                    item.recipient.email ||
                    item.recipient.id}
                </span>
                {item.recipient.role && ` (${item.recipient.role})`}
              </p>
            )}
            <p className="mt-2 text-xs text-on-surface-variant">
              {dateTimeFormatter.format(new Date(item.createdAt))}
            </p>
          </div>
          {!showRecipient && (
            <button
              type="button"
              onClick={() => onMarkRead(item)}
              disabled={busy || item.isRead}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check aria-hidden="true" size={18} />
              Đã đọc
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
