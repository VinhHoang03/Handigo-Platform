import { useMemo, useState } from "react";
import { CalendarClock, CircleAlert } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order, OrderReschedulePreview } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";

type ViewerRole = "CUSTOMER" | "PROVIDER";

const toInputValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 3_600_000);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString("vi-VN")
  : "Chưa xác định";

export function OrderReschedulePanel({
  order,
  viewerRole,
  onChanged,
}: {
  order: Order;
  viewerRole: ViewerRole;
  onChanged: () => Promise<unknown> | unknown;
}) {
  const viewer = viewerRole.toLowerCase() as "customer" | "provider";
  const request = order.latestRescheduleRequest;
  const pending = request?.status === "pending" ? request : null;
  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => toInputValue(order.scheduledAt));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<OrderReschedulePreview | null>(null);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [referenceTimestamp, setReferenceTimestamp] = useState(() => Date.now());
  const [responseReason, setResponseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isInitiator = pending?.initiatorRole === viewer;
  const canRespond = pending?.approvalRole === viewer && !isInitiator;
  const eligibility = order.rescheduleEligibility;
  const canRequest = eligibility?.canRequest === true && !pending;
  const minimumInput = useMemo(() => {
    const minimum = new Date(referenceTimestamp + (eligibility?.minAdvanceMinutes ?? 0) * 60_000);
    return toInputValue(minimum.toISOString());
  }, [eligibility?.minAdvanceMinutes, referenceTimestamp]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (caught) {
      setError(getErrorMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!scheduledAt) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await bookingApi.previewReschedule(order._id, new Date(scheduledAt).toISOString()));
    } catch (caught) {
      setPreview(null);
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    await run(() => bookingApi.createRescheduleRequest(order._id, {
      scheduledAt: new Date(scheduledAt).toISOString(),
      reason: reason.trim(),
      warningAcknowledged,
      expectedOrderUpdatedAt: order.updatedAt,
    }));
    setOpen(false);
    setPreview(null);
    setReason("");
    setWarningAcknowledged(false);
  };

  const handleResponse = async (decision: "accept" | "reject") => {
    if (!pending) return;
    try {
      await run(() => bookingApi.respondRescheduleRequest(order._id, pending._id, {
        decision,
        ...(responseReason.trim() ? { reason: responseReason.trim() } : {}),
        expectedOrderUpdatedAt: order.updatedAt,
      }));
      setResponseReason("");
    } catch { /* Lỗi đã hiển thị trong panel. */ }
  };

  if (order.orderType !== "scheduled") return null;

  return (
    <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" size={22} className="text-primary" />
            <h3 className="font-headline-sm text-lg font-bold text-on-surface">Dời lịch hẹn</h3>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Mỗi phía được dời lịch thành công một lần cho đơn này.
          </p>
        </div>
        {canRequest && (
          <button type="button" onClick={() => { setReferenceTimestamp(Date.now()); setOpen(true); setError(""); }}
            className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover">
            {viewerRole === "PROVIDER" ? "Đề nghị dời lịch" : "Dời lịch"}
          </button>
        )}
      </div>

      {pending && (
        <div className="mt-md rounded-2xl border border-primary/20 bg-primary/5 p-md">
          <p className="font-semibold text-on-surface">
            {isInitiator ? "Đang chờ bên còn lại phản hồi" : "Có đề nghị dời lịch cần bạn phản hồi"}
          </p>
          <dl className="mt-sm grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-on-surface-variant">Lịch hiện tại</dt><dd className="font-semibold">{formatDate(pending.oldScheduledAt)}</dd></div>
            <div><dt className="text-on-surface-variant">Lịch đề xuất</dt><dd className="font-semibold text-primary">{formatDate(pending.proposedScheduledAt)}</dd></div>
          </dl>
          <p className="mt-sm text-sm"><span className="text-on-surface-variant">Lý do:</span> {pending.reason}</p>
          {pending.expiresAt && <p className="mt-1 text-xs text-on-surface-variant">Phản hồi trước {formatDate(pending.expiresAt)}.</p>}
          {isInitiator && (
            <button type="button" disabled={busy} onClick={() => void run(() => bookingApi.cancelRescheduleRequest(order._id, pending._id)).catch(() => undefined)}
              className="mt-md rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold disabled:opacity-50">
              Thu hồi yêu cầu
            </button>
          )}
          {canRespond && (
            <div className="mt-md space-y-sm">
              <textarea value={responseReason} onChange={(event) => setResponseReason(event.target.value)} maxLength={500}
                placeholder="Lý do từ chối (bắt buộc khi từ chối)" className="min-h-20 w-full rounded-xl border border-outline-variant bg-surface p-3" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void handleResponse("accept")}
                  className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-50">Đồng ý lịch mới</button>
                <button type="button" disabled={busy || responseReason.trim().length < 3} onClick={() => void handleResponse("reject")}
                  className="rounded-xl border border-error/30 px-4 py-2 font-semibold text-error disabled:opacity-50">Từ chối</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!pending && !canRequest && eligibility && (
        <p className="mt-md rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          {eligibility.remainingCount === 0
            ? `Phía ${viewerRole === "PROVIDER" ? "chuyên gia" : "khách hàng"} đã sử dụng lượt dời lịch của đơn này.`
            : "Đơn hiện không đủ điều kiện dời lịch."}
        </p>
      )}
      {error && <p role="alert" className="mt-sm text-sm font-medium text-error">{error}</p>}

      <Modal open={open} title={viewerRole === "PROVIDER" ? "Đề nghị dời lịch" : "Dời lịch hẹn"}
        onClose={() => { if (!busy) { setOpen(false); setPreview(null); setError(""); } }} size="sm"
        footer={<div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-outline-variant px-4 py-2">Đóng</button>
          {!preview ? (
            <button type="button" disabled={busy || !scheduledAt || reason.trim().length < 3} onClick={() => void handlePreview()}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-50">Kiểm tra lịch</button>
          ) : (
            <button type="button" disabled={busy || (preview.warningRequired && !warningAcknowledged)} onClick={() => void handleSubmit().catch(() => undefined)}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-50">Gửi yêu cầu</button>
          )}
        </div>}>
        <div className="space-y-md">
          <div className="rounded-xl bg-surface-container-low p-3 text-sm">Lịch hiện tại: <strong>{formatDate(order.scheduledAt)}</strong></div>
          <label className="block text-sm font-semibold">Lịch mới
            <input type="datetime-local" min={minimumInput} value={scheduledAt}
              onChange={(event) => { setScheduledAt(event.target.value); setPreview(null); setWarningAcknowledged(false); }}
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface p-3" />
          </label>
          <label className="block text-sm font-semibold">Lý do
            <textarea value={reason} onChange={(event) => { setReason(event.target.value); setPreview(null); }} maxLength={500}
              className="mt-1 min-h-24 w-full rounded-xl border border-outline-variant bg-surface p-3" placeholder="Nhập lý do dời lịch" />
          </label>
          {preview && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-md text-sm">
              <p>Lịch đề xuất: <strong>{formatDate(preview.proposedScheduledAt)}</strong></p>
              <p className="mt-1">{preview.approvalRequired ? "Lịch mới chỉ có hiệu lực sau khi bên còn lại đồng ý." : "Lịch mới sẽ được áp dụng ngay và hệ thống tìm lại chuyên gia."}</p>
            </div>
          )}
          {preview?.warningRequired && (
            <label className="flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-md text-sm">
              <input type="checkbox" checked={warningAcknowledged} onChange={(event) => setWarningAcknowledged(event.target.checked)} />
              <span><strong>Cảnh báo:</strong> Đây có thể là lần dời lịch thứ {Number(preview.providerMonthlyAppliedCount) + 1} của bạn trong tháng. Tôi đã kiểm tra kỹ thời gian mới.</span>
            </label>
          )}
          {error && <div role="alert" className="flex gap-2 rounded-xl bg-error/10 p-3 text-sm text-error"><CircleAlert size={18} />{error}</div>}
        </div>
      </Modal>
    </section>
  );
}
