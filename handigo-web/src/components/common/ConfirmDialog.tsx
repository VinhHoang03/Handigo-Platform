import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  variant?: 'primary' | 'danger';
}

export function ConfirmDialog({ open, title, message, busy, onCancel, onConfirm, variant = 'primary' }: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm" danger={variant === 'danger'} closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      <p className="text-on-surface-variant">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary min-h-12">Quay lại</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`min-h-12 rounded-xl px-5 py-2.5 font-semibold text-white shadow-md disabled:opacity-50 ${variant === 'danger' ? 'bg-error' : 'bg-primary'}`}>
          {busy ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
      </div>
    </Modal>
  );
}
