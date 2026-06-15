import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, message, busy, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-on-surface-variant">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
        <button onClick={onConfirm} disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
          {busy ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
      </div>
    </Modal>
  );
}
