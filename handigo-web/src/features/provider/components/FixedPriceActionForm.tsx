import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { Order } from '@/types/booking';
import { formatMoney } from '../utils/providerOrder.utils';

interface FixedPriceActionFormProps {
  order: Order;
  onStart: () => void | Promise<void>;
  onComplete: (files: File[], note: string) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

const MAX_EVIDENCE_IMAGES = 5;

export function FixedPriceActionForm({
  order,
  onStart,
  onComplete,
  onCancel,
  busy,
}: FixedPriceActionFormProps) {
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState('');
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const showStart = order.status === 'accepted' && !order.inspectionRequired;
  const showComplete = order.status === 'in_progress';
  const showCancel = ['accepted', 'in_progress'].includes(order.status);
  const currentStep =
    order.status === 'completed' ? 3 : order.status === 'in_progress' ? 2 : 1;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    setFiles((current) => [...current, ...selectedFiles].slice(0, MAX_EVIDENCE_IMAGES));
    setValidationError('');
    event.target.value = '';
  };

  const handleComplete = () => {
    if (files.length === 0) {
      setValidationError('Vui lòng tải lên ít nhất một ảnh bằng chứng hoàn thành.');
      return;
    }
    void onComplete(files, note);
  };

  return (
    <div className="glass-card flex h-full flex-col space-y-md rounded-3xl p-md">
      <div>
        <h3 className="font-headline-md text-on-surface">Tiến độ thực hiện</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Cập nhật đúng từng bước để khách hàng theo dõi trạng thái đơn.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {['Đã nhận đơn', 'Đang thực hiện', 'Đã hoàn thành'].map((label, index) => {
          const step = index + 1;
          const isDone = step <= currentStep;
          return (
            <div key={label} className="text-center">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  isDone
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step < currentStep ? (
                  <span className="material-symbols-outlined text-lg">check</span>
                ) : (
                  step
                )}
              </div>
              <p className={`mt-2 text-xs font-medium ${isDone ? 'text-primary' : 'text-on-surface-variant'}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {!order.inspectionRequired && (
        <div className="rounded-2xl bg-primary/5 p-md">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Giá dịch vụ
          </p>
          <p className="text-headline-md font-bold text-primary">
            {formatMoney(order.pricing.totalPaidAmount)}
          </p>
        </div>
      )}

      {showComplete && (
        <div className="space-y-md">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-label-sm font-medium text-on-surface">
                Ảnh bằng chứng hoàn thành <span className="text-error">*</span>
              </span>
              <span className="text-xs text-on-surface-variant">
                {files.length}/{MAX_EVIDENCE_IMAGES} ảnh
              </span>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-5 text-sm font-medium text-primary transition-colors hover:border-primary">
              <span className="material-symbols-outlined">add_photo_alternate</span>
              Chọn ảnh hoàn thành
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy || files.length >= MAX_EVIDENCE_IMAGES}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {previews.length > 0 && (
              <div className="mt-sm grid grid-cols-3 gap-sm">
                {previews.map((url, index) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-xl">
                    <img src={url} alt={`Bằng chứng ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label={`Xóa ảnh ${index + 1}`}
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {validationError && <p className="mt-2 text-sm text-error">{validationError}</p>}
          </div>

          <label className="block space-y-2">
            <span className="text-label-sm text-on-surface-variant">Ghi chú hoàn thành (tùy chọn)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              disabled={busy}
              className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="Mô tả công việc đã thực hiện..."
            />
          </label>
        </div>
      )}

      {order.status === 'completed' && order.completionEvidenceImages?.length ? (
        <div>
          <p className="mb-sm text-sm font-medium text-on-surface">Bằng chứng đã gửi</p>
          <div className="grid grid-cols-3 gap-sm">
            {order.completionEvidenceImages.map((url, index) => (
              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl">
                <img src={url} alt={`Bằng chứng hoàn thành ${index + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-sm pt-md">
        {showStart && (
          <button type="button" disabled={busy} onClick={onStart} className="btn-primary w-full py-3 text-base font-bold">
            {busy ? 'Đang xử lý...' : 'Bắt đầu thực hiện'}
          </button>
        )}
        {showComplete && (
          <button type="button" disabled={busy} onClick={handleComplete} className="btn-primary w-full py-3 text-base font-bold">
            {busy ? 'Đang tải ảnh và hoàn thành...' : 'Xác nhận hoàn thành'}
          </button>
        )}
        {showCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-xl py-2 text-sm font-medium text-error transition-colors hover:bg-error/5"
          >
            Hủy đơn dịch vụ
          </button>
        )}
      </div>
    </div>
  );
}
