import { useState, type FormEvent } from 'react';
import type { Order } from '@/types/booking';
import { providerOrderApi } from '../../api/providerOrder.api';
import { getErrorMessage } from '@/utils/apiError';

export function OrderScheduleCard({ order }: { order: Order }) {
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [expectedEnd, setExpectedEnd] = useState(order.schedule?.expectedEndAt);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await providerOrderApi.updateExpectedEnd(order._id, new Date(end).toISOString());
      setExpectedEnd(result.order.schedule?.expectedEndAt);
      setNotice(result.affectedOrderCount ? `Đã cập nhật. Có ${result.affectedOrderCount} lịch bị ảnh hưởng; khách đã được gửi thông báo. Vui lòng liên hệ để thống nhất xử lý.` : 'Đã cập nhật giờ hoàn thành dự kiến.');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md space-y-3">
    <h3 className="font-semibold">Thời gian thực hiện</h3>
    {order.schedule && <p className="text-sm">Dự kiến {order.schedule.durationMinutes} phút; dự phòng {order.schedule.bufferMinutes} phút; di chuyển {order.schedule.travelMinutes} phút.</p>}
    {!order.schedule && <p className="text-sm">Đơn cũ chưa lưu thời lượng. Hệ thống dùng thời lượng dự phòng theo cấu hình khi kiểm tra lịch.</p>}
    {expectedEnd && <p className="text-sm">Hoàn thành dự kiến: {new Date(expectedEnd).toLocaleString('vi-VN')}</p>}
    {order.status === 'in_progress' && <form onSubmit={submit} className="space-y-2">
      <label className="block text-sm">Cập nhật giờ hoàn thành khi công việc thay đổi<input className="mt-1 block rounded-lg border border-outline-variant bg-surface p-2" type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <button className="rounded-lg bg-primary px-4 py-2 text-on-primary disabled:opacity-50" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Cập nhật thời gian'}</button>
    </form>}
    {notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-sm text-error">{error}</p>}
  </section>;
}
