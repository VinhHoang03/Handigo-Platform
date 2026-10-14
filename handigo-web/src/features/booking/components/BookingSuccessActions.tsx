import { Link } from 'react-router-dom';
import { House, Map } from "lucide-react";

export const BookingSuccessActions = ({ orderId, retryPayment = false }: { orderId: string; retryPayment?: boolean }) => (
  <div className="flex flex-col sm:flex-row gap-3 mt-3 w-full max-w-4xl text-sm">
    <Link
      to={`/customer/bookings/${orderId}`}
      className="flex-1 min-h-11 py-2 px-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-sm"
    >
      <Map aria-hidden="true" size={24} />
      {retryPayment ? 'Tiếp tục thanh toán' : 'Xem và theo dõi đơn hàng'}
    </Link>
    <Link
      to="/customer"
      className="flex-1 min-h-11 py-2 px-3 bg-surface-container-high/50 text-primary border border-outline-variant/30 rounded-xl font-bold hover:bg-surface-container-highest/20 transition-all active:scale-95 flex items-center justify-center gap-sm"
    >
      <House aria-hidden="true" size={24} />
      Về trang chủ
    </Link>
  </div>
);
