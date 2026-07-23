import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { Order } from '@/types/booking';
import { ReliableImage } from '@/components/common/ReliableImage';

interface FixedPriceActionFormProps {
  order: Order;
  onStart: () => void | Promise<void>;
  onComplete: (files: File[], note: string) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

const MAX_EVIDENCE_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_COMPLETION_NOTE_LENGTH = 1000;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (selectedFiles.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
      setValidationError('Chỉ hỗ trợ ảnh JPEG, PNG, WebP, GIF hoặc AVIF.');
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setValidationError('Mỗi ảnh không được vượt quá 5 MB.');
      return;
    }
    if (files.length + selectedFiles.length > MAX_EVIDENCE_IMAGES) {
      setValidationError(
        'Chỉ được tải tối đa ' + MAX_EVIDENCE_IMAGES + ' ảnh.',
      );
      return;
    }

    setFiles((current) => [...current, ...selectedFiles]);
    setValidationError('');
  };

  const handleComplete = () => {
    if (files.length === 0) {
      setValidationError('Vui lòng tải lên ít nhất một ảnh bằng chứng hoàn thành.');
      return;
    }
    if (note.trim().length > MAX_COMPLETION_NOTE_LENGTH) {
      setValidationError(
        'Ghi chú không được vượt quá ' +
          MAX_COMPLETION_NOTE_LENGTH +
          ' ký tự.',
      );
      return;
    }
    setValidationError('');
    void onComplete(files, note.trim());
  };

  return (
    <div className="flex h-full flex-col space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">task_alt</span>
          <h3 className="font-headline-md text-on-surface">Thao tác đơn hàng</h3>
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          Cập nhật trạng thái và bằng chứng thực hiện dịch vụ.
        </p>
      </div>

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
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
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
                    <ReliableImage src={url} alt={`Bằng chứng ${index + 1}`} className="h-full w-full object-cover" />
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
              maxLength={MAX_COMPLETION_NOTE_LENGTH}
              rows={4}
              disabled={busy}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
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
                <ReliableImage src={url} alt={`Bằng chứng hoàn thành ${index + 1}`} className="h-full w-full object-cover" />
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
            className="w-full rounded-xl border border-error/30 py-2.5 text-sm font-bold text-error transition-colors hover:bg-error/5"
          >
            Hủy đơn dịch vụ
          </button>
        )}
      </div>
    </div>
  );
}
