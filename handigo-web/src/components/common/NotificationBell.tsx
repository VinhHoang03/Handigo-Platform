import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { AppRole } from "./Navbar";
import { NotificationBellPanel } from "./notification-bell/NotificationBellPanel";
import { ReassignmentPromptModal } from "./notification-bell/ReassignmentPromptModal";
import { useNotificationFeed } from "./notification-bell/useNotificationFeed";
import { useReassignmentPrompt } from "./notification-bell/useReassignmentPrompt";
import { Bell } from "lucide-react";

export function NotificationBell({ role }: { role?: AppRole }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reassignment = useReassignmentPrompt();
  const feed = useNotificationFeed(role, {
    onReassignmentRequired: reassignment.present,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        feed.setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feed.setOpen is a stable setState reference
  }, [feed.setOpen]);

  if (!feed.canUseUserNotifications) {
    return (
      <Link
        to={feed.notificationPath}
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
        aria-expanded={feed.open}
        onClick={feed.toggleOpen}
        className="relative grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
      >
        <Bell aria-hidden="true" size={22} />
        {feed.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-error px-1.5 text-center text-[11px] font-bold leading-5 text-on-error">
            {feed.unreadCount > 99 ? "99+" : feed.unreadCount}
          </span>
        )}
      </button>

      {feed.open && (
        <NotificationBellPanel
          unreadCount={feed.unreadCount}
          isReadFilter={feed.query.isRead}
          onChangeFilter={feed.changeUnreadFilter}
          onMarkAll={() => void feed.markAll()}
          loading={feed.loading}
          error={feed.error}
          items={feed.items}
          onMarkAsRead={(item) => void feed.markAsRead(item)}
          hasMore={(feed.query.page || 1) < feed.totalPages}
          loadingMore={feed.loadingMore}
          onLoadMore={feed.loadMore}
        />
      )}

      {reassignment.action && (
        <ReassignmentPromptModal
          expiresAt={reassignment.action.expiresAt}
          busy={reassignment.busy}
          error={reassignment.error}
          onClose={reassignment.dismiss}
          onDecline={() => void reassignment.respond("decline")}
          onAccept={() => void reassignment.respond("accept")}
        />
      )}
    </div>
  );
}
