import { useEffect, useState } from "react";
import { useToast } from "@/components/common/Toast";
import { bookingApi } from "@/features/booking/api/booking.api";
import { getErrorMessage } from "@/utils/apiError";
import type { CancellationPreview, Order, OrderQuotation } from "@/types/booking";
import type { PendingAction } from "./bookingDetailConstants";

/**
 * ⚠️ Luồng từ chối báo giá và hủy đơn (kèm xem trước chính sách hoàn
 * tiền) — đụng tiền. Giữ nguyên toàn bộ điều kiện và thứ tự gọi API gốc.
 */
export const useBookingCancellationFlow = (
  order: Order | null,
  quotation: OrderQuotation | null,
  busy: boolean,
  setBusy: (busy: boolean) => void,
  loadData: () => Promise<void>,
) => {
  const { addToast } = useToast();
  const [cancellationPreview, setCancellationPreview] =
    useState<CancellationPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [cancellationNow, setCancellationNow] = useState(() => Date.now());
  const hasAcceptedProvider = order?.status === "accepted";
  const cancellationDeadline = order?.customerCancellationDeadline
    ? Date.parse(order.customerCancellationDeadline) : NaN;
  const cancellationLocked = order?.status === "in_progress" || (hasAcceptedProvider
    && (!Number.isFinite(cancellationDeadline) || cancellationNow > cancellationDeadline));

  useEffect(() => {
    if (!hasAcceptedProvider || !Number.isFinite(cancellationDeadline)) return;
    const timer = window.setInterval(() => setCancellationNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasAcceptedProvider, cancellationDeadline]);

  const handleRejectQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: "rejectQuotation", reason: "" });
  };

  const handleCancelOrder = async () => {
    if (!order || cancellationLocked || !["created", "accepted"].includes(order.status)) return;
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
      addToast("Không thể tải chính sách hoàn tiền. Vui lòng đóng và thử lại.", "error");
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
      cancellationLocked ||
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
          : preview.items.find((item) => !item.canCancel)?.policyReason || "Có buổi đã hết thời hạn hủy.",
      });
    } catch {
      addToast("Không thể tải chính sách hoàn tiền cho chuỗi lịch. Vui lòng đóng và thử lại.", "error");
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
    if (isCancellationAction && cancellationLocked) {
      addToast(order?.status === "in_progress"
        ? "Thợ đã bắt đầu làm việc, bạn không thể hủy đơn hàng."
        : "Đã hết thời hạn hủy 5 phút kể từ khi thợ nhận đơn.", "error");
      return;
    }
    if (!reason) {
      addToast(isCancellationAction ? "Vui lòng chọn lý do hủy đơn." : "Vui lòng nhập lý do.", "error");
      setPendingAction({
        ...pendingAction,
        error: isCancellationAction ? "Vui lòng chọn lý do hủy đơn." : "Vui lòng nhập lý do.",
      });
      return;
    }
    if (isCancellationAction && reason === "Lý do khác" && !additionalInfo) {
      addToast("Vui lòng nhập thông tin cho lý do khác.", "error");
      setPendingAction({ ...pendingAction, error: "Vui lòng nhập thông tin cho lý do khác." });
      return;
    }
    if (isCancellationAction && additionalInfo) {
      reason = `${reason}: ${additionalInfo}`;
    }

    try {
      setBusy(true);
      if (pendingAction.type === "rejectQuotation") {
        if (!quotation) return;
        await bookingApi.rejectQuotation(quotation.quotation._id, reason);
      } else if (pendingAction.type === "cancelOrder") {
        if (!order) return;
        await bookingApi.cancelOrder(order._id, reason);
      } else if (pendingAction.type === "cancelSeries") {
        if (!order) return;
        await bookingApi.cancelRecurringSeries(order._id, reason);
      }

      addToast(pendingAction.type === "rejectQuotation" ? "Đã từ chối báo giá." : "Đã hủy lịch dịch vụ.", "success");
      setPendingAction(null);
      setCancellationPreview(null);
      await loadData();
    } catch (error) {
      addToast(getErrorMessage(error, "Không thể thực hiện thao tác. Vui lòng thử lại."), "error");
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
    cancellationLocked,
    cancellationPreview,
    pendingAction,
    handleRejectQuotation,
    handleCancelOrder,
    handleCancelSeries,
    closeActionDialog,
    updateActionReason,
    updateAdditionalInfo,
    executePendingAction,
  };
};
