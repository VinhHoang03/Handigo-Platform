import { useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import { getErrorMessage } from "@/utils/apiError";
import type { CancellationPreview, Order, OrderQuotation } from "@/types/booking";
import type { PendingAction } from "./bookingDetailConstants";

/**
 * ⚠️ Luồng xác nhận/từ chối báo giá và hủy đơn (kèm xem trước chính sách hoàn
 * tiền) — đụng tiền. Giữ nguyên toàn bộ điều kiện và thứ tự gọi API gốc.
 */
export const useBookingCancellationFlow = (
  order: Order | null,
  quotation: OrderQuotation | null,
  busy: boolean,
  setBusy: (busy: boolean) => void,
  loadData: () => Promise<void>,
) => {
  const [cancellationPreview, setCancellationPreview] =
    useState<CancellationPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const handleConfirmQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: "confirmQuotation", reason: "" });
  };

  const handleRejectQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: "rejectQuotation", reason: "" });
  };

  const handleCancelOrder = async () => {
    if (!order || !["created", "accepted"].includes(order.status)) return;
    try {
      setBusy(true);
      const preview = await bookingApi.getCancellationPreview(order._id);
      setCancellationPreview(preview);
      setPendingAction({
        type: "cancelOrder",
        reason: "",
        additionalInfo: "",
        error: preview.canCancel ? undefined : preview.items[0]?.policyReason,
      });
    } catch {
      setCancellationPreview(null);
      setPendingAction({
        type: "cancelOrder",
        reason: "",
        additionalInfo: "",
        error: "Không thể tải chính sách hoàn tiền. Vui lòng đóng và thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSeries = async () => {
    if (
      !order ||
      order.orderType !== "recurring" ||
      !["created", "accepted"].includes(order.status)
    ) return;
    try {
      setBusy(true);
      const preview = await bookingApi.getCancellationPreview(order._id, "series");
      setCancellationPreview(preview);
      setPendingAction({
        type: "cancelSeries",
        reason: "",
        additionalInfo: "",
        error: preview.canCancel
          ? undefined
          : "Có buổi đã đến giờ thực hiện và không thể tự hủy.",
      });
    } catch {
      setCancellationPreview(null);
      setPendingAction({
        type: "cancelSeries",
        reason: "",
        additionalInfo: "",
        error:
          "Không thể tải chính sách hoàn tiền cho chuỗi lịch. Vui lòng đóng và thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  const closeActionDialog = () => {
    if (!busy) {
      setPendingAction(null);
      setCancellationPreview(null);
    }
  };

  const updateActionReason = (reason: string) => {
    setPendingAction((current) =>
      current ? { ...current, reason, error: undefined } : current,
    );
  };

  const updateAdditionalInfo = (additionalInfo: string) => {
    setPendingAction((current) =>
      current ? { ...current, additionalInfo, error: undefined } : current,
    );
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;

    let reason = pendingAction.reason.trim();
    const additionalInfo = pendingAction.additionalInfo?.trim() || "";
    const isCancellationAction = ["cancelOrder", "cancelSeries"].includes(
      pendingAction.type,
    );
    if (pendingAction.type !== "confirmQuotation" && !reason) {
      setPendingAction({
        ...pendingAction,
        error: isCancellationAction ? "Vui lòng chọn lý do hủy đơn." : "Vui lòng nhập lý do.",
      });
      return;
    }
    if (isCancellationAction && reason === "Lý do khác" && !additionalInfo) {
      setPendingAction({ ...pendingAction, error: "Vui lòng nhập thông tin cho lý do khác." });
      return;
    }
    if (isCancellationAction && additionalInfo) {
      reason = `${reason}: ${additionalInfo}`;
    }

    try {
      setBusy(true);
      if (pendingAction.type === "confirmQuotation") {
        if (!quotation) return;
        await bookingApi.confirmQuotation(quotation.quotation._id);
      } else if (pendingAction.type === "rejectQuotation") {
        if (!quotation) return;
        await bookingApi.rejectQuotation(quotation.quotation._id, reason);
      } else if (pendingAction.type === "cancelOrder") {
        if (!order) return;
        await bookingApi.cancelOrder(order._id, reason);
      } else if (pendingAction.type === "cancelSeries") {
        if (!order) return;
        await bookingApi.cancelRecurringSeries(order._id, reason);
      }

      setPendingAction(null);
      setCancellationPreview(null);
      await loadData();
    } catch (error) {
      setPendingAction((current) =>
        current
          ? {
              ...current,
              error: getErrorMessage(
                error,
                "Không thể thực hiện thao tác. Vui lòng thử lại.",
              ),
            }
          : current,
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    cancellationPreview,
    pendingAction,
    handleConfirmQuotation,
    handleRejectQuotation,
    handleCancelOrder,
    handleCancelSeries,
    closeActionDialog,
    updateActionReason,
    updateAdditionalInfo,
    executePendingAction,
  };
};
