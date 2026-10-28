import { useEffect, useMemo, useState } from 'react';
import type { Order } from '@/types/booking';
import { Modal } from '@/components/common/Modal';
import { ReliableImage } from '@/components/common/ReliableImage';
import { Plus, X } from 'lucide-react';

interface Props {
  order: Order;
  busy: boolean;
  onArrival: () => Promise<void>;
  onCancel?: () => void;
  checkNoShow: () => Promise<boolean>;
  onNoShow: (description: string, arrivalFiles: File[], contactFiles: File[]) => Promise<boolean>;
}

export function OrderArrivalPanel({ order, busy, onArrival, onCancel, checkNoShow, onNoShow }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [arrivalFiles, setArrivalFiles] = useState<File[]>([]);
  const [contactFiles, setContactFiles] = useState<File[]>([]);
  const [contacted, setContacted] = useState(false);
  const [error, setError] = useState('');
  const previews = useMemo(() => ({
    arrival: arrivalFiles.map((file) => URL.createObjectURL(file)),
    contact: contactFiles.map((file) => URL.createObjectURL(file)),
  }), [arrivalFiles, contactFiles]);
  useEffect(() => () => {
    [...previews.arrival, ...previews.contact].forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);
  const arrived = !!order.arrival && order.arrival.providerId === order.providerId?._id;
  const report = order.customerNoShow;
  const appointmentReady = !['scheduled', 'recurring'].includes(order.orderType) || order.bookingStatus === 'confirmed';
  if (order.status !== 'accepted' && !report) return null;
  return (
    <section className="space-y-3 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md">
      <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-3">
      <h2 className="flex items-center gap-2 font-headline-md font-bold normal-case">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-sky-500" />
        Đến địa chỉ khách hàng
      </h2>
      {report ? <p role="status" className="text-sm text-on-surface-variant">
        {report.status === 'pending' ? 'Báo cáo khách không có mặt đang chờ duyệt. Chưa thể bắt đầu làm việc.'
          : report.status === 'approved' ? 'Đã chấp thuận báo cáo, hủy đơn và cộng hỗ trợ 5.000đ vào ví.'
            : 'Báo cáo không được chấp thuận. Bạn có thể tiếp tục làm việc hoặc liên hệ hỗ trợ để được xem xét lại.'}
      </p> : !arrived ? (
        <div className="flex items-stretch gap-3">
          <button type="button" className={`btn-primary ${onCancel ? 'min-w-0 flex-1' : ''}`} disabled={busy || !appointmentReady} onClick={() => void onArrival()}>
            {busy ? 'Đang xử lý...' : 'Đã đến nơi'}
          </button>
          {onCancel && <button type="button" disabled={busy} onClick={onCancel}
            className="min-w-0 flex-1 rounded-xl border border-error/30 px-3 py-2.5 text-sm font-bold text-error transition-colors hover:bg-error/5 disabled:opacity-50">
            Hủy đơn dịch vụ
          </button>}
        </div>
      ) : <p className="text-sm text-on-surface-variant">Đã thông báo cho khách bạn đến nơi. Gọi hoặc nhắn tin nếu chưa gặp được khách.</p>}
      </div>
      {arrived && !report && order.status === 'accepted' && <button type="button" className="btn-secondary max-w-[45%] shrink-0 text-center" disabled={busy}
        onClick={() => { void checkNoShow().then((eligible) => { if (eligible) setOpen(true); }); }}>
        Không liên hệ được khách
      </button>}
      </div>
      {!appointmentReady && <p className="text-sm text-on-surface-variant">Lịch hẹn chưa được thanh toán và xác nhận.</p>}
      <Modal open={open} title="Báo khách không có mặt" onClose={() => { if (!busy) setOpen(false); }} closeOnOverlayClick={!busy}>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if (!contacted || description.trim().length < 10 || !arrivalFiles.length || !contactFiles.length) {
            setError('Vui lòng mô tả ít nhất 10 ký tự, chọn đủ ảnh đã đến nơi và ảnh liên hệ, rồi xác nhận đã liên hệ khách.'); return;
          }
          void onNoShow(description.trim(), arrivalFiles, contactFiles).then((success) => { if (success) setOpen(false); });
        }}>
          <label className="block space-y-2"><span>Mô tả việc liên hệ khách</span>
            <textarea required minLength={10} maxLength={2000} rows={4} value={description} disabled={busy}
              onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-outline-variant p-3" />
          </label>
          {(['arrival', 'contact'] as const).map((kind) => <fieldset key={kind} className="space-y-2"><legend className="text-sm font-semibold">
            {kind === 'arrival' ? 'Ảnh đã đến nơi (bắt buộc)' : 'Ảnh liên hệ khách hàng (bắt buộc)'}
          </legend>
            <p className="text-xs text-on-surface-variant">{kind === 'arrival' ? 'Chọn ảnh thể hiện địa điểm đã đến; không bắt buộc có biển số nhà.'
              : 'Để tự duyệt, cần cả ảnh chat Handigo và ảnh chi tiết ít nhất 3 cuộc gọi đi tới đúng số khách, rõ giờ từng cuộc.'}</p>
            <div className="grid grid-cols-[repeat(auto-fill,6rem)] gap-3">
              {previews[kind].map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-low">
                <ReliableImage src={url} alt={`${kind === 'arrival' ? 'Ảnh đã đến nơi' : 'Ảnh liên hệ khách'} ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" disabled={busy}
                  onClick={() => {
                    (kind === 'arrival' ? setArrivalFiles : setContactFiles)((current) => current.filter((_, fileIndex) => fileIndex !== index));
                    setError('');
                  }}
                  aria-label={`Xóa ${kind === 'arrival' ? 'ảnh đã đến nơi' : 'ảnh liên hệ khách'} ${index + 1}`}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
                  <X aria-hidden="true" size={16} />
                </button>
              </div>)}
              <label className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low text-primary transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${busy || previews[kind].length >= 4 || arrivalFiles.length + contactFiles.length >= 5 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary hover:bg-primary/5'}`}>
                <Plus aria-hidden="true" size={24} />
                <span className="text-xs font-medium">Thêm ảnh</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only"
                  aria-label={kind === 'arrival' ? 'Thêm ảnh đã đến nơi' : 'Thêm ảnh liên hệ khách hàng'}
                  disabled={busy || previews[kind].length >= 4 || arrivalFiles.length + contactFiles.length >= 5} onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    if (!selected.length) return;
                    if (selected.length + previews[kind].length > 4 || selected.length + arrivalFiles.length + contactFiles.length > 5
                      || selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                      setError('Mỗi loại tối đa 4 ảnh, tổng cộng tối đa 5 ảnh JPEG, PNG hoặc WebP; mỗi ảnh tối đa 5 MB.'); return;
                    }
                    setError('');
                    (kind === 'arrival' ? setArrivalFiles : setContactFiles)((current) => [...current, ...selected]);
                  }} />
              </label>
            </div>
          </fieldset>)}
          <p className="text-xs text-on-surface-variant">Đã chọn {arrivalFiles.length + contactFiles.length}/5 ảnh · Mỗi ảnh tối đa 5 MB.</p>
          <label className="flex items-start gap-2"><input type="checkbox" required checked={contacted} disabled={busy}
            onChange={(event) => setContacted(event.target.checked)} />Tôi đã gọi hoặc nhắn tin nhưng không liên hệ được khách.</label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Đang phân tích và gửi báo cáo...' : 'Gửi báo cáo'}</button>
        </form>
      </Modal>
    </section>
  );
}
