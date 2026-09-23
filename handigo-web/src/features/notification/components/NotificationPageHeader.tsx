import { CheckCheck, Megaphone, RefreshCw } from "lucide-react";
export function NotificationPageHeader({
  isAdmin,
  busy,
  unreadCount,
  onRefresh,
  onMarkAll,
  onOpenSend,
}: {
  isAdmin: boolean;
  busy: boolean;
  unreadCount: number;
  onRefresh: () => void;
  onMarkAll: () => void;
  onOpenSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-headline-lg font-bold text-on-background">
          Thông báo
        </h1>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
        >
          <RefreshCw aria-hidden="true" size={20} />
          Tải lại
        </button>
        {!isAdmin && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck aria-hidden="true" size={20} />
            Đánh dấu tất cả
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenSend}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
          >
            <Megaphone aria-hidden="true" size={20} />
            Gửi thông báo
          </button>
        )}
      </div>
    </div>
  );
}
