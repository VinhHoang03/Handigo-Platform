import type { ReactNode } from "react";
import { NearbyProviderSelector } from "@/features/customer-service/components/NearbyProviderSelector";
import type { Order } from "@/types/booking";

type BookingStatusBannersProps = {
  order: Order;
  isWaitingForProvider: boolean;
  matchingSecondsRemaining: number | null;
  busy: boolean;
  replacementProviderId: string | undefined;
  replacementProviderError: string | null;
  onSelectReplacementProvider: (providerId?: string) => void;
  onClearReplacementProviderError: () => void;
  onSubmitReplacementProvider: () => void;
  onOpenReassignmentModal: () => void;
  /**
   * Banner nhắc thanh toán ban đầu (⚠️ đụng tiền, xem `BookingPaymentPanel`).
   * Nhận qua slot để giữ đúng vị trí hiển thị gốc (giữa banner đổi kỹ thuật
   * viên và banner giữ lịch) mà không cần trộn logic tiền vào file này.
   */
  paymentBannerSlot?: ReactNode;
};

/**
 * Các banner trạng thái thông tin (không đụng tiền): chờ chuyên gia nhận đơn,
 * đếm ngược điều phối, tóm tắt yêu cầu đổi kỹ thuật viên, giữ lịch, chọn lại
 * chuyên gia khi bị từ chối, và hết hạn thanh toán. Giữ nguyên mọi điều kiện gốc.
 */
export const BookingStatusBanners = ({
  order,
  isWaitingForProvider,
  matchingSecondsRemaining,
  busy,
  replacementProviderId,
  replacementProviderError,
  onSelectReplacementProvider,
  onClearReplacementProviderError,
  onSubmitReplacementProvider,
  onOpenReassignmentModal,
  paymentBannerSlot,
}: BookingStatusBannersProps) => (
  <>
    {order.bookingStatus === "awaiting_provider" && (
      <div className="mb-lg rounded-2xl border border-primary/20 bg-primary-container/10 p-md text-sm text-on-surface">
        <p className="font-bold">Đang chờ chuyên gia xác nhận lịch hẹn</p>
        <p className="mt-1 text-on-surface-variant">
          Bạn chưa cần thanh toán. Handigo sẽ thông báo ngay khi chuyên gia phản hồi.
        </p>
      </div>
    )}

    {isWaitingForProvider && matchingSecondsRemaining !== null && (
      <div className="mb-lg rounded-2xl border border-primary/20 bg-primary-container/10 p-md text-sm text-on-surface">
        <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Đang tìm chuyên gia nhận đơn</p>
            <p className="mt-1 text-on-surface-variant">
              Handigo đang gửi yêu cầu đến các chuyên gia phù hợp gần bạn.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-surface px-5 py-3 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Thời gian còn lại
            </p>
            <p
              aria-live="polite"
              className="mt-1 font-mono text-2xl font-bold tabular-nums text-primary"
            >
              {String(Math.floor(matchingSecondsRemaining / 60)).padStart(2, "0")}:
              {String(matchingSecondsRemaining % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
        {matchingSecondsRemaining === 0 && (
          <p className="mt-sm font-medium text-warning">
            Đã hết thời gian tìm chuyên gia, hệ thống đang cập nhật kết quả đơn hàng.
          </p>
        )}
      </div>
    )}

    {order.reassignment?.status === "awaiting_customer" && (
      <div className="mb-lg rounded-2xl border border-warning/30 bg-warning-container p-md text-sm text-on-warning-container">
        <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">
              {order.bookingStatus === "rejected"
                ? "Provider bạn chọn đã từ chối nhận đơn"
                : "Kỹ thuật viên đã hủy đơn"}
            </p>
            <p className="mt-1">
              {order.bookingStatus === "rejected"
                ? "Handigo sẽ tự điều phối thợ gần nhất đến cho bạn nếu bạn đồng ý. Nếu từ chối, khoản đã thanh toán sẽ được hoàn về ví Handigo."
                : "Hãy cho Handigo biết bạn muốn tìm kỹ thuật viên khác hay hủy đơn và hoàn tiền."}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenReassignmentModal}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary"
          >
            Chọn phương án xử lý
          </button>
        </div>
      </div>
    )}

    {paymentBannerSlot}

    {order.bookingStatus === "reserved" && (
      <div className="mb-lg rounded-2xl border border-success/30 bg-success-container p-md text-sm text-on-success-container">
        <p className="font-bold">Chuyên gia đã giữ lịch cho buổi này</p>
        <p className="mt-1 text-on-success-container">
          Thanh toán sẽ được mở trước giờ thực hiện 24 giờ. Handigo sẽ gửi thông báo khi đến hạn.
        </p>
      </div>
    )}

    {order.bookingStatus === "rejected" &&
      order.orderType !== "normal" &&
      order.reassignment?.status !== "awaiting_customer" && (
      <div className="mb-lg rounded-2xl border border-error/20 bg-error/5 p-md">
        <p className="font-bold text-error">Chuyên gia chưa thể nhận lịch này</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Chọn một chuyên gia khác còn trống trong cùng khung giờ.
        </p>
        <div className="mt-md">
          <NearbyProviderSelector
            serviceId={order.serviceId._id}
            addressId={order.addressId._id}
            scheduledAt={order.scheduledAt || undefined}
            recurrenceUnit={order.recurrenceUnit || undefined}
            recurrenceCount={order.totalOccurrences || undefined}
            requireSelection
            selectedProviderId={replacementProviderId}
            onSelectProvider={(providerId) => {
              onSelectReplacementProvider(providerId);
              onClearReplacementProviderError();
            }}
          />
        </div>
        {replacementProviderError && (
          <p className="mt-sm text-sm font-medium text-error">{replacementProviderError}</p>
        )}
        <button
          type="button"
          disabled={busy || !replacementProviderId}
          onClick={onSubmitReplacementProvider}
          className="mt-md rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
        >
          {busy ? "Đang gửi..." : "Gửi yêu cầu cho chuyên gia"}
        </button>
      </div>
    )}

    {order.bookingStatus === "expired" && (
      <div className="mb-lg rounded-2xl border border-error/20 bg-error/10 p-md text-sm text-error">
        <p className="font-bold">Lịch hẹn đã hết thời gian thanh toán</p>
        <p className="mt-1">Yêu cầu đã được giải phóng để chuyên gia nhận lịch khác.</p>
      </div>
    )}
  </>
);
