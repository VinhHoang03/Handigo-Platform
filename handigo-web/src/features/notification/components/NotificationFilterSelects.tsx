import type { NotificationQuery } from "../types/notification.types";
import { notificationTypeLabels } from "./notification-type-meta";

const selectClassName =
  "rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30";

export function NotificationFilterSelects({
  isAdmin,
  query,
  onQueryChange,
}: {
  isAdmin: boolean;
  query: NotificationQuery;
  onQueryChange: (query: NotificationQuery) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {isAdmin && (
        <select
          value={query.targetRole || ""}
          onChange={(event) =>
            onQueryChange({
              ...query,
              targetRole: event.target
                .value as NotificationQuery["targetRole"],
              page: 1,
            })
          }
          className={selectClassName}
        >
          <option value="">Tất cả người nhận</option>
          <option value="CUSTOMER">Khách hàng</option>
          <option value="PROVIDER">Nhà cung cấp</option>
        </select>
      )}
      <select
        value={query.type || ""}
        onChange={(event) =>
          onQueryChange({
            ...query,
            type: event.target.value as NotificationQuery["type"],
            page: 1,
          })
        }
        className={selectClassName}
      >
        <option value="">Tất cả loại</option>
        {Object.entries(notificationTypeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={query.isRead === "" ? "" : String(query.isRead)}
        onChange={(event) => {
          const value = event.target.value;
          onQueryChange({
            ...query,
            isRead: value === "" ? "" : value === "true",
            page: 1,
          });
        }}
        className={selectClassName}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="false">Chưa đọc</option>
        <option value="true">Đã đọc</option>
      </select>
    </div>
  );
}
