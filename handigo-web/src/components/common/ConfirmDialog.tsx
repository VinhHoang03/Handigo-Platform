import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  busy?: boolean;
  variant?: "danger" | "default";
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  busy,
  variant = "default",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === "danger"
      ? "min-h-12 rounded-lg px-5 py-2.5 font-semibold shadow-md transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 bg-error text-on-error hover:bg-error/90 focus-visible:ring-error/20"
      : "min-h-12 rounded-lg px-5 py-2.5 font-semibold shadow-md transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 bg-primary text-on-primary hover:bg-primary-container focus-visible:ring-primary/20";
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      closeOnEsc={!busy}
      closeOnOverlayClick={!busy}
    >
      <p className="text-on-surface-variant">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="btn-secondary min-h-12"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={confirmClass}
        >
          {busy ? "Đang xử lý..." : "Xác nhận"}
        </button>
      </div>
    </Modal>
  );
}
