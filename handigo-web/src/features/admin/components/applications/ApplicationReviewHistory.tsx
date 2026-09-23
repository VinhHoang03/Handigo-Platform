import type { AdminApplication } from "../../types/admin.types";
import { formatDate } from "./application-detail.utils";

const actionLabel = (action: NonNullable<AdminApplication["reviewHistory"]>[number]["action"]) =>
  action === "submitted"
    ? "Đã gửi hồ sơ"
    : action === "resubmitted"
      ? "Đã gửi lại"
      : action === "approved"
        ? "✓ Đã phê duyệt"
        : "✗ Đã từ chối";

const borderColor = (action: NonNullable<AdminApplication["reviewHistory"]>[number]["action"]) =>
  action === "approved" ? "border-secondary/40" : action === "rejected" ? "border-error/40" : "border-outline-variant/40";

export function ApplicationReviewHistory({ application }: { application: AdminApplication }) {
  return (
    <>
      {application.rejectionReason && (
        <section className="rounded-2xl border border-error/30 bg-error-container/20 p-4 text-on-error-container">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-bold">Từ chối gần nhất</h3>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <p><b>Lý do:</b> {application.rejectionReason}</p>
            <p><b>Ghi chú:</b> {application.rejectionNotes || "Chưa cập nhật"}</p>
            <p><b>Ngày duyệt:</b> {formatDate(application.reviewedAt || undefined)}</p>
            <p><b>Người duyệt:</b> {application.reviewedBy?.fullName || "Quản trị viên"}</p>
          </div>
        </section>
      )}

      {Boolean(application.reviewHistory?.length) && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">📋 Lịch sử xét duyệt</h3>
          <ol className="space-y-2">
            {application.reviewHistory?.map((event, index) => {
              const actor = typeof event.actorId === "string" ? "Người dùng hệ thống" : event.actorId.fullName;
              return (
                <li key={`${event.action}-${event.occurredAt}-${index}`} className={`rounded-xl border ${borderColor(event.action)} bg-surface-container-low p-3 text-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-on-surface">{actionLabel(event.action)}</p>
                    <span className="text-xs text-on-surface-variant">{formatDate(event.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">Bởi: {actor}</p>
                  {event.rejectionReason && <p className="mt-1 text-xs"><b>Lý do:</b> {event.rejectionReason}</p>}
                  {event.notes && <p className="mt-1 text-xs"><b>Ghi chú:</b> {event.notes}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}
