import { Link } from 'react-router-dom';
import { useBookingStore } from '../hooks/useBookingStore';

export function RebookingNotice() {
  const source = useBookingStore(state => state.rebookSource);
  const requestedProviderName = useBookingStore(state => state.requestedProviderName);
  if (!source) return null;
  return <section aria-label="Thông tin đặt lại" className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
    <p className="font-bold">Đang đặt lại từ đơn <Link to={`/customer/bookings/${source.orderId}`} className="text-primary underline">{source.orderCode}</Link></p>
    <p>Vui lòng kiểm tra thông tin, chọn thời gian thực hiện mới và xác nhận giá hiện tại. Bạn có thể thay đổi các lựa chọn đã điền sẵn.</p>
    {requestedProviderName && <p>Thợ mong muốn: <strong>{requestedProviderName}</strong>. Khả dụng sẽ được kiểm tra theo địa chỉ và lịch mới.</p>}
    {source.notices.map(notice => <p key={notice} className="text-on-surface-variant">{notice}</p>)}
  </section>;
}
