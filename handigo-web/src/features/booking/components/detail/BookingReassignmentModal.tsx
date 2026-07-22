import { Modal } from "@/components/common/Modal";
import type { Order } from "@/types/booking";

type BookingReassignmentModalProps = {
  order: Order;
  open: boolean;
  busy: boolean;
  reassignmentError: string | null;
  onClose: () => void;
  onRespond: (decision: "accept" | "decline") => void;
};

/**
 * Modal hỏi khách hàng muốn Handigo điều phối thợ khác hay hủy đơn khi kỹ
 * thuật viên từ chối/hủy. Chỉ hiển thị khi `reassignment.status` đang chờ phản hồi.
 */
export const BookingReassignmentModal = ({
  order,
  open,
  busy,
  reassignmentError,
  onClose,
  onRespond,
}: BookingReassignmentModalProps) => {
  if (order.reassignment?.status !== "awaiting_customer") return null;

  return (
    <Modal
      open={open}
      title={
        order.bookingStatus === "rejected"
          ? "Bạn có muốn Handigo điều phối thợ gần nhất?"
          : "Bạn có muốn tìm kỹ thuật viên khác?"
      }
      onClose={onClose}
      size="sm"
      closeOnEsc={!busy}
      closeOnOverlayClick={!busy}
    >
      <div className="space-y-md">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">
            {order.bookingStatus === "rejected"
              ? "Provider bạn chọn đã từ chối nhận đơn hàng."
              : "Kỹ thuật viên không thể tiếp tục thực hiện đơn hàng."}
          </p>
          <p className="mt-2 leading-6">
            Nếu tiếp tục, Handigo sẽ giữ nguyên thông tin và khoản thanh toán
            để tự điều phối thợ phù hợp gần bạn. Nếu từ chối, đơn sẽ được hủy
            và khoản đã thanh toán sẽ được hoàn về ví Handigo.
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Phản hồi trước {new Date(order.reassignment.expiresAt).toLocaleString("vi-VN")}.
          </p>
        </div>

        {reassignmentError && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {reassignmentError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRespond("decline")}
            className="rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Hủy đơn và hoàn tiền
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRespond("accept")}
            className="rounded-2xl bg-primary px-5 py-3 font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy
              ? "Đang xử lý..."
              : order.bookingStatus === "rejected"
                ? "Điều phối thợ gần nhất"
                : "Tìm kỹ thuật viên khác"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
