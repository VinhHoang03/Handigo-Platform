import { Modal } from "../Modal";

interface ReassignmentPromptModalProps {
  expiresAt?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onDecline: () => void;
  onAccept: () => void;
}

/** Hộp thoại xác nhận khi kỹ thuật viên hủy đơn sau khi nhận. */
export function ReassignmentPromptModal({
  expiresAt,
  busy,
  error,
  onClose,
  onDecline,
  onAccept,
}: ReassignmentPromptModalProps) {
  return (
    <Modal
      open
      title="Bạn có muốn tìm kỹ thuật viên khác?"
      onClose={onClose}
      size="sm"
      closeOnEsc={!busy}
      closeOnOverlayClick={!busy}
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          Kỹ thuật viên đã hủy đơn sau khi nhận. Handigo có thể giữ nguyên đơn
          và khoản thanh toán để tìm người thay thế. Nếu bạn từ chối, đơn sẽ
          được hủy và hoàn tiền theo phương thức đã thanh toán.
        </p>
        {expiresAt && (
          <p className="rounded-xl bg-warning-container px-4 py-3 text-sm font-medium text-on-warning-container">
            Phản hồi trước {new Date(expiresAt).toLocaleString("vi-VN")}.
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="rounded-xl border border-error/30 px-4 py-3 font-bold text-error disabled:opacity-50"
          >
            Hủy đơn và hoàn tiền
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50"
          >
            {busy ? "Đang xử lý..." : "Tìm kỹ thuật viên khác"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
