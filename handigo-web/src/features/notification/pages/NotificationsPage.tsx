import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { NotificationBanner } from "../components/NotificationBanner";
import { NotificationFilterSelects } from "../components/NotificationFilterSelects";
import { NotificationList } from "../components/NotificationList";
import { NotificationListSkeleton } from "../components/NotificationListSkeleton";
import { NotificationLoadMore } from "../components/NotificationLoadMore";
import { NotificationPageHeader } from "../components/NotificationPageHeader";
import { NotificationQuickFilters } from "../components/NotificationQuickFilters";
import { NotificationStatsGrid } from "../components/NotificationStatsGrid";
import { SendNotificationModal } from "../components/SendNotificationModal";
import {
  useNotificationsPageController,
  type NotificationRole,
} from "../components/use-notifications-page";

export default function NotificationsPage({
  role,
}: {
  role: NotificationRole;
}) {
  const {
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
  } = useNotificationsPageController(role);

  return (
    <DashboardShell role={role}>
      <div className="space-y-6">
        <NotificationPageHeader
          isAdmin={isAdmin}
          busy={busy}
          unreadCount={unreadCount}
          onRefresh={() => void refresh()}
          onMarkAll={() => void markAll()}
          onOpenSend={() => setSendOpen(true)}
        />

        <NotificationStatsGrid stats={stats} />

        <NotificationBanner error={error} notice={notice} />

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">
                Danh sách thông báo
              </h2>
              <p className="text-sm text-on-surface-variant">
                {isAdmin
                  ? "Sắp xếp theo thời gian mới nhất."
                  : "Thông báo mới nhất hiển thị trước, có thể tải thêm thông báo cũ hơn."}
              </p>
            </div>
            <NotificationFilterSelects
              isAdmin={isAdmin}
              query={query}
              onQueryChange={setQuery}
            />
          </div>

          {!isAdmin && (
            <NotificationQuickFilters
              query={query}
              unreadCount={unreadCount}
              onQueryChange={setQuery}
            />
          )}

          <AsyncState
            loading={loading}
            error={error && !items.length ? error : ""}
            empty={!items.length}
            emptyMessage="Chưa có thông báo."
            onRetry={refresh}
            skeleton={<NotificationListSkeleton />}
          >
            <NotificationList
              items={items}
              busy={busy}
              showRecipient={isAdmin}
              onMarkRead={markOne}
            />
          </AsyncState>
          {isAdmin ? (
            <Pagination
              page={query.page || 1}
              totalPages={totalPages}
              onChange={(page) => setQuery({ ...query, page })}
            />
          ) : (
            <NotificationLoadMore
              page={query.page || 1}
              totalPages={totalPages}
              loadingMore={loadingMore}
              hasItems={items.length > 0}
              onLoadMore={() => void loadMore()}
            />
          )}
        </section>
      </div>

      <SendNotificationModal
        open={sendOpen}
        form={sendForm}
        busy={busy}
        onChange={setSendForm}
        onClose={() => setSendOpen(false)}
        onSubmit={submitSystemNotification}
      />
    </DashboardShell>
  );
}
