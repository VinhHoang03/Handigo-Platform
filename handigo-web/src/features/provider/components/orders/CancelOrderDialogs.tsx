import { Modal } from '@/components/common/Modal';

const cancellationReasons = [
  'Không thể sửa chữa hoặc thực hiện dịch vụ',
  'Khách hàng cung cấp thông tin chưa đầy đủ',
  'Không thể liên hệ với khách hàng',
  'Lịch hẹn không còn phù hợp',
  'Lý do khác',
];

interface CancellationDialogProps {
  reason: string;
  explanation: string;
  error: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancellationDialog({
  reason,
  explanation,
  error,
  busy,
  onReasonChange,
  onExplanationChange,
  onClose,
  onConfirm,
}: CancellationDialogProps) {
  return (
    <Modal open title="Hủy đơn dịch vụ" onClose={onClose} size="lg" closeOnOverlayClick={!busy} closeOnEsc={!busy} danger>
      <p className="text-sm text-on-surface-variant">Lý do hủy sẽ được lưu cùng đơn hàng và thông báo cho khách hàng.</p>
      <div className="mt-md space-y-2">
        {cancellationReasons.map((item) => (
          <label key={item} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${reason === item ? 'border-error bg-error/5' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}>
            <input type="radio" name="cancel-reason" value={item} checked={reason === item} onChange={() => onReasonChange(item)} className="mt-1 text-error focus:ring-error" />
            <span className="text-sm font-medium text-on-surface">{item}</span>
          </label>
        ))}
      </div>
      <label className="mt-md block">
        <span className="text-sm font-medium text-on-surface">Giải thích thêm {reason === 'Lý do khác' && <span className="text-error">*</span>}</span>
        <textarea value={explanation} onChange={(event) => onExplanationChange(event.target.value)} maxLength={500} rows={5} aria-invalid={Boolean(error)} className="mt-2 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-error focus:ring-4 focus:ring-error/10" placeholder={reason === 'Lý do khác' ? 'Mô tả cụ thể lý do hủy (ít nhất 10 ký tự)...' : 'Bổ sung thông tin để khách hàng hiểu rõ hơn (không bắt buộc)...'} />
        <span className="mt-1 block text-right text-xs text-on-surface-variant">{explanation.length}/500</span>
      </label>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-md flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Quay lại</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error px-5 py-3 font-bold text-on-error shadow-md transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"><span className="material-symbols-outlined">warning</span>Tiếp tục hủy đơn</button>
      </div>
    </Modal>
  );
}

interface CancelConfirmationDialogProps {
  reason: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function CancelConfirmationDialog({ reason, busy, onBack, onConfirm }: CancelConfirmationDialogProps) {
  return (
    <Modal open title="Xác nhận hủy đơn?" onClose={onBack} size="md" closeOnOverlayClick={!busy} closeOnEsc={!busy} danger>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
        <span className="material-symbols-outlined text-3xl">warning</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">Hành động này sẽ hủy đơn dịch vụ và thông báo cho khách hàng. Vui lòng kiểm tra lại trước khi xác nhận.</p>
      <div className="mt-4 rounded-2xl bg-error/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-error">Lý do đã chọn</p>
        <p className="mt-1 text-sm font-medium text-on-surface">{reason}</p>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} disabled={busy} className="btn-secondary min-h-12">Kiểm tra lại</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error px-5 py-3 font-bold text-on-error shadow-md transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50">
          <span className="material-symbols-outlined">delete_forever</span>
          {busy ? 'Đang hủy đơn...' : 'Hủy đơn ngay'}
        </button>
      </div>
    </Modal>
  );
}
