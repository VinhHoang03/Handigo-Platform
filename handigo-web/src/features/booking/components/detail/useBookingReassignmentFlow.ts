import { useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order } from "@/types/booking";

/**
 * Luồng chọn chuyên gia thay thế và phản hồi yêu cầu đổi kỹ thuật viên.
 * Từ chối (decline) dẫn tới hoàn tiền về ví Handigo ở backend — giữ nguyên hành vi gọi API.
 */
export const useBookingReassignmentFlow = (
  order: Order | null,
  setOrder: (order: Order) => void,
  reassignmentModalOpen: boolean,
  setReassignmentModalOpen: (open: boolean) => void,
  busy: boolean,
  setBusy: (busy: boolean) => void,
  loadData: () => Promise<void>,
) => {
  const [replacementProviderId, setReplacementProviderId] = useState<string>();
  const [replacementProviderError, setReplacementProviderError] = useState<string | null>(null);
  const [reassignmentError, setReassignmentError] = useState<string | null>(null);

  const handleSelectReplacementProvider = async () => {
    if (!order || !replacementProviderId) {
      setReplacementProviderError("Vui lòng chọn một chuyên gia còn lịch trống.");
      return;
    }
    try {
      setBusy(true);
      setReplacementProviderError(null);
      await bookingApi.selectAppointmentProvider(order._id, replacementProviderId);
      setReplacementProviderId(undefined);
      await loadData();
    } catch (error) {
      console.error("Không thể gửi lại yêu cầu lịch hẹn:", error);
      setReplacementProviderError(
        "Không thể gửi yêu cầu cho chuyên gia này. Vui lòng chọn người khác.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReassignmentResponse = async (
    decision: "accept" | "decline",
  ) => {
    if (!order) return;
    try {
      setBusy(true);
      setReassignmentError(null);
      const updatedOrder = await bookingApi.respondToReassignment(
        order._id,
        decision,
      );
      setOrder(updatedOrder);
      setReassignmentModalOpen(false);
      await loadData();
    } catch (error) {
      console.error("Không thể xử lý yêu cầu đổi kỹ thuật viên:", error);
      setReassignmentError(
        "Không thể xử lý lựa chọn của bạn. Vui lòng tải lại trang và thử lại.",
      );
    } finally {
      setBusy(false);
    }
  };

  const closeReassignmentModal = () => {
    if (!busy) setReassignmentModalOpen(false);
  };

  return {
    replacementProviderId,
    setReplacementProviderId,
    replacementProviderError,
    setReplacementProviderError,
    reassignmentError,
    reassignmentModalOpen,
    handleSelectReplacementProvider,
    handleReassignmentResponse,
    closeReassignmentModal,
    openReassignmentModal: () => setReassignmentModalOpen(true),
  };
};
