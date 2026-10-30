import { useEffect, useState } from "react";
import { CalendarClock, CircleAlert, LoaderCircle, Check } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order, OrderReschedulePreview } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import { RescheduleDateTimePicker } from './RescheduleDateTimePicker';
import { vietnamDateTimeValue, rescheduleTimestamp, isRescheduleTimeAllowed, firstRescheduleTime } from '../../utils/rescheduleDateTime';

type ViewerRole = "CUSTOMER" | "PROVIDER";

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString("vi-VN", { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
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
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [scheduledAt, setScheduledAt] = useState(() => vietnamDateTimeValue(order.scheduledAt ? Date.parse(order.scheduledAt) : Date.now()));
  const [reason, setReason] = useState("");
  const [previewResult, setPreviewResult] = useState<{ value: string; version: string; data?: OrderReschedulePreview; error?: string } | null>(null);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [referenceTimestamp, setReferenceTimestamp] = useState(() => Date.now());
  const [responseReason, setResponseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isInitiator = pending?.initiatorRole === viewer;
  const canRespond = pending?.approvalRole === viewer && !isInitiator;
  const eligibility = order.rescheduleEligibility;
  const canRequest = eligibility?.canRequest === true && !pending;
  const earliest = referenceTimestamp + (eligibility?.minAdvanceMinutes ?? 0) * 60_000;
  const selectionValid = isRescheduleTimeAllowed(scheduledAt, earliest);
  const sameSchedule = rescheduleTimestamp(scheduledAt) === Date.parse(order.scheduledAt ?? '');
  const currentResult = previewResult?.value === scheduledAt && previewResult.version === order.updatedAt ? previewResult : null;
  const preview = selectionValid && !sameSchedule ? currentResult?.data : undefined;
  const checking = open && selectionValid && !sameSchedule && !currentResult;

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setReferenceTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !selectionValid || sameSchedule) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void bookingApi.previewReschedule(order._id, new Date(rescheduleTimestamp(scheduledAt)).toISOString())
        .then(data => { if (active) setPreviewResult({ value: scheduledAt, version: order.updatedAt, data }); })
        .catch(caught => { if (active) setPreviewResult({ value: scheduledAt, version: order.updatedAt, error: getErrorMessage(caught) }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, order._id, order.updatedAt, scheduledAt, selectionValid, sameSchedule, previewAttempt]);

  const changeSchedule = (value: string) => {
    setScheduledAt(value);
    setPreviewResult(null);
    setWarningAcknowledged(false);
    setError('');
  };

  const openPicker = () => {
    const now = Date.now();
    const minimum = now + (eligibility?.minAdvanceMinutes ?? 0) * 60_000;
    const current = vietnamDateTimeValue(order.scheduledAt ? Date.parse(order.scheduledAt) : minimum);
    const day = vietnamDateTimeValue(minimum).slice(0, 10);
    const fallback = firstRescheduleTime(day, minimum)
      ?? `${vietnamDateTimeValue(rescheduleTimestamp(`${day}T08:00`) + 86400000).slice(0, 10)}T08:00`;
    changeSchedule(isRescheduleTimeAllowed(current, minimum) ? current : fallback);
    setReferenceTimestamp(now);
    setOpen(true);
  };

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

  const handleSubmit = async () => {
    if (!preview || busy || reason.trim().length < 3 || (preview.warningRequired && !warningAcknowledged)) return;
    await run(() => bookingApi.createRescheduleRequest(order._id, {
      scheduledAt: new Date(rescheduleTimestamp(scheduledAt)).toISOString(),
      reason: reason.trim(),
      warningAcknowledged,
      expectedOrderUpdatedAt: order.updatedAt,
    }));
    setOpen(false);
    setPreviewResult(null);
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
            Bạn có một lần dời lịch duy nhất ở đơn dịch vụ này.
          </p>
        </div>
        {canRequest && (
          <button type="button" onClick={openPicker}
            className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover">
            {viewerRole === "PROVIDER" ? "Đề nghị dời lịch" : "Yêu cầu dời lịch"}
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
            <div><dt className="text-on-surface-variant">Lịch yêu cầu</dt><dd className="font-semibold text-primary">{formatDate(pending.proposedScheduledAt)}</dd></div>
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
            ? `${viewerRole === "PROVIDER" ? "Chuyên gia" : "Khách hàng"} đã hết lượt dời lịch.`
            : "Đơn hiện không đủ điều kiện dời lịch."}
        </p>
      )}
      {error && <p role="alert" className="mt-sm text-sm font-medium text-error">{error}</p>}

      <Modal open={open} title={viewerRole === "PROVIDER" ? "Đề nghị dời lịch" : "Yêu cầu dời lịch"}
        onClose={() => { if (!busy) { setOpen(false); setPreviewResult(null); setError(""); } }} size="md"
        footer={<div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-outline-variant px-4 py-2">Đóng</button>
          <button type="button" disabled={busy || !preview || reason.trim().length < 3 || (preview.warningRequired && !warningAcknowledged)} onClick={() => void handleSubmit().catch(() => undefined)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold text-on-primary disabled:opacity-50">
            {(busy || checking) && <LoaderCircle aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" />}
            {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
          </button>
        </div>}>
        <div className="space-y-md">
          <div className="rounded-xl bg-surface-container-low p-3 text-sm">Lịch hiện tại: <strong>{formatDate(order.scheduledAt)}</strong></div>
          <fieldset disabled={busy} className="min-w-0">
            <legend className="mb-3 text-sm text-on-surface-variant">Chọn ngày và giờ mới · Báo trước ít nhất {eligibility?.minAdvanceMinutes ?? 0} phút</legend>
            <div inert={busy}>
              <RescheduleDateTimePicker key={open ? 'open' : 'closed'} value={scheduledAt} earliest={earliest} onChange={changeSchedule} />
            </div>
          </fieldset>
          <div aria-live="polite" aria-atomic="true" className="rounded-2xl border border-primary/20 bg-primary/5 p-md text-sm">
            <p className="text-xs text-on-surface-variant">Lịch đề xuất</p>
            <p className="mt-1 text-lg font-bold text-primary">{formatDate(new Date(rescheduleTimestamp(scheduledAt)).toISOString())}</p>
            <div className="mt-2 flex min-h-6 items-center gap-2 text-on-surface-variant">
              {checking ? <><LoaderCircle aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" /> Đang kiểm tra lịch trống…</>
                : sameSchedule ? 'Chọn thời gian khác lịch hiện tại.'
                : !selectionValid ? 'Vui lòng chọn thời gian đủ điều kiện báo trước, từ 08:00 đến 21:00.'
                : currentResult?.error ? <span className="text-error">{currentResult.error} <button type="button" onClick={() => { setPreviewResult(null); setPreviewAttempt(value => value + 1); }} className="underline" >Thử lại</button></span>
                : preview ? <><Check aria-hidden="true" size={16} className="text-primary" />{preview.approvalRequired ? 'Lịch phù hợp. Chờ bên còn lại đồng ý sau khi gửi.' : 'Lịch phù hợp. Áp dụng ngay khi gửi yêu cầu.'}</> : null}
            </div>
          </div>
          <label className="block text-sm font-semibold">Lý do
            <textarea value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} maxLength={500}
              className="mt-1 min-h-24 w-full rounded-xl border border-outline-variant bg-surface p-3" placeholder="Nhập lý do dời lịch" />
          </label>
          {preview?.warningRequired && (
            <label className="flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-md text-sm">
              <input type="checkbox" checked={warningAcknowledged} onChange={(event) => setWarningAcknowledged(event.target.checked)} />
              <span><strong>Cảnh báo:</strong> Bạn đã dời lịch thành công {preview.providerMonthlyAppliedCount} lần trong tháng. Yêu cầu này có thể trở thành lần thứ {Number(preview.providerMonthlyAppliedCount) + 1}. Tôi đã kiểm tra kỹ thời gian mới.</span>
            </label>
          )}
          {error && <div role="alert" className="flex gap-2 rounded-xl bg-error/10 p-3 text-sm text-error"><CircleAlert size={18} />{error}</div>}
        </div>
      </Modal>
    </section>
  );
}
