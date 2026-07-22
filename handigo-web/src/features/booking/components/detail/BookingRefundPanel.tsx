import { Modal } from "@/components/common/Modal";
import type { CancellationPreview, Order } from "@/types/booking";
import { getActionDialogConfig, type PendingAction } from "./bookingDetailConstants";
import { BookingCancellationPreviewCard } from "./BookingCancellationPreviewCard";
import { BookingCancellationReasonForm } from "./BookingCancellationReasonForm";

type BookingRefundPanelProps = {
  order: Order;
  busy: boolean;
  pendingAction: PendingAction | null;
  cancellationPreview: CancellationPreview | null;
  onCancelOrder: () => void;
  onCancelSeries: () => void;
  onCloseDialog: () => void;
  onUpdateReason: (reason: string) => void;
  onUpdateAdditionalInfo: (info: string) => void;
  onExecute: () => void;
};

/**
 * ⚠️ Đụng tiền — nút hủy đơn/chuỗi lịch và modal xác nhận dùng chung cho cả
 * xác nhận/từ chối báo giá lẫn hủy đơn (kèm xem trước chính sách hoàn tiền).
 * Giữ nguyên toàn bộ điều kiện disable, validate lý do hủy và hiển thị hoàn tiền gốc.
 */
export const BookingRefundPanel = ({
  order,
  busy,
  pendingAction,
  cancellationPreview,
  onCancelOrder,
  onCancelSeries,
  onCloseDialog,
  onUpdateReason,
  onUpdateAdditionalInfo,
  onExecute,
}: BookingRefundPanelProps) => {
  const actionDialogConfig = pendingAction
    ? getActionDialogConfig(pendingAction.type)
    : null;
  const isCancellationAction = pendingAction
    ? ["cancelOrder", "cancelSeries"].includes(pendingAction.type)
    : false;

  return (
    <>
      {["created", "accepted"].includes(order.status) &&
        order.reassignment?.status !== "awaiting_customer" && (
        <div className="space-y-2">
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-error/20 py-3 font-bold text-error transition-all hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancelOrder}
          >
            {busy ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-error/20 border-t-error" />
            ) : (
              <span className="material-symbols-outlined text-sm">close</span>
            )}
            {order.orderType === "recurring" ? "Hủy buổi này" : "Hủy yêu cầu"}
          </button>
          {order.orderType === "recurring" && (
            <button
              disabled={busy}
              className="w-full rounded-2xl bg-error py-3 font-bold text-on-error transition hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCancelSeries}
            >
              Hủy buổi này và các buổi sau
            </button>
          )}
        </div>
      )}

      {pendingAction && actionDialogConfig && (
        <Modal
          open
          title={actionDialogConfig.title}
          onClose={onCloseDialog}
          size="sm"
          closeOnEsc={!busy}
          closeOnOverlayClick={!busy}
        >
          <div className="space-y-md">
            <p className="text-body-md text-on-surface-variant">
              {actionDialogConfig.message}
            </p>

            {isCancellationAction && cancellationPreview && (
              <BookingCancellationPreviewCard
                cancellationPreview={cancellationPreview}
              />
            )}

            {isCancellationAction ? (
              <BookingCancellationReasonForm
                reason={pendingAction.reason}
                additionalInfo={pendingAction.additionalInfo}
                busy={busy}
                onUpdateReason={onUpdateReason}
                onUpdateAdditionalInfo={onUpdateAdditionalInfo}
              />
            ) : actionDialogConfig.requiresReason && (
              <label className="block">
                <span className="mb-2 block text-label-sm font-bold uppercase text-on-surface-variant">
                  Lý do
                </span>
                <textarea
                  value={pendingAction.reason}
                  onChange={(event) => onUpdateReason(event.target.value)}
                  disabled={busy}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  placeholder="Nhập lý do..."
                />
              </label>
            )}

            {pendingAction.error && (
              <div className="rounded-2xl border border-error/30 bg-error/8 px-4 py-3 text-sm font-medium text-error">
                {pendingAction.error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-sm pt-sm sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={onCloseDialog}
                className="rounded-2xl bg-surface-container-high px-5 py-3 font-bold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (isCancellationAction &&
                    (!cancellationPreview || !cancellationPreview.canCancel))
                }
                onClick={onExecute}
                className={`rounded-2xl px-5 py-3 font-bold text-on-primary transition disabled:opacity-50 ${
                  actionDialogConfig.tone === "danger"
                    ? "bg-error hover:bg-error/90"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {busy ? "Đang xử lý..." : actionDialogConfig.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
