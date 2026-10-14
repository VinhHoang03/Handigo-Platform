import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getErrorMessage } from '@/utils/apiError';

interface Props {
  image: HTMLImageElement;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

export function ServiceImageCropModal({ image, busy, onCancel, onConfirm }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const confirmLock = useRef(false);
  const locked = busy || confirming;
  const scale = Math.max(1280 / image.naturalWidth, 720 / image.naturalHeight) * zoom;
  const maxX = (image.naturalWidth * scale - 1280) / 2;
  const maxY = (image.naturalHeight * scale - 720) / 2;
  const x = Math.max(-maxX, Math.min(maxX, position.x));
  const y = Math.max(-maxY, Math.min(maxY, position.y));
  const small = 1280 / scale < 800 || 720 / scale < 450;

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1280, 720);
    context.drawImage(image, (1280 - image.naturalWidth * scale) / 2 + x,
      (720 - image.naturalHeight * scale) / 2 + y, image.naturalWidth * scale, image.naturalHeight * scale);
  }, [image, scale, x, y]);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Tab') return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!locked) onCancel();
      } else {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
        const first = elements[0], last = elements.at(-1);
        if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [locked, onCancel]);

  const confirm = async () => {
    if (confirmLock.current || locked) return;
    confirmLock.current = true;
    setConfirming(true);
    setError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current?.toBlob(
        value => value ? resolve(value) : reject(new Error('Không thể cắt ảnh')), 'image/png'));
      if (blob.size > 5 * 1024 * 1024) throw new Error('Ảnh sau cắt vượt quá 5 MB');
      await onConfirm(new File([blob], 'service-image.png', { type: 'image/png' }));
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể xử lý ảnh'));
    } finally {
      confirmLock.current = false;
      setConfirming(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Cắt ảnh dịch vụ" className="max-h-[95dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-surface p-5">
        <h2 className="mb-2 text-xl font-bold">Cắt ảnh dịch vụ · 16:9</h2>
        <p className="mb-4 text-sm">Kéo ảnh và điều chỉnh độ phóng đại. Ảnh được lưu ở 1280 × 720 px.</p>
        <canvas ref={canvas} width={1280} height={720} className="aspect-video w-full cursor-move rounded-lg touch-none"
          onPointerDown={event => {
            if (locked) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, offsetX: x, offsetY: y };
          }}
          onPointerMove={event => {
            if (!drag.current || locked) return;
            const factor = 1280 / event.currentTarget.getBoundingClientRect().width;
            setPosition({
              x: Math.max(-maxX, Math.min(maxX, drag.current.offsetX + (event.clientX - drag.current.x) * factor)),
              y: Math.max(-maxY, Math.min(maxY, drag.current.offsetY + (event.clientY - drag.current.y) * factor)),
            });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        />
        <label className="my-4 block">Thu nhỏ / Phóng to
          <input className="mt-2 w-full" aria-label="Độ phóng đại ảnh" disabled={locked} type="range" min="1" max="4" step="0.01" value={zoom}
            onChange={event => { setZoom(Number(event.target.value)); setPosition({ x, y }); }} />
        </label>
        {small && <p role="status" className="mb-3 text-amber-700">Vùng ảnh nguồn nhỏ hơn 800 × 450 px. Ảnh có thể bị mờ khi phóng lớn; nên chọn ảnh có độ phân giải cao hơn.</p>}
        {error && <p role="alert" className="mb-3 text-error">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={locked} onClick={onCancel} className="rounded-lg border px-4 py-2">Hủy</button>
          <button type="button" disabled={locked} onClick={() => void confirm()} className="rounded-lg bg-primary px-4 py-2 text-on-primary">{locked ? 'Đang tải ảnh…' : 'Xác nhận và lưu ảnh'}</button>
        </div>
      </div>
    </div>, document.body);
}
