import { Link } from 'react-router-dom';
import { House, Map } from "lucide-react";

export const BookingSuccessActions = ({ orderId }: { orderId: string }) => (
  <div className="flex flex-col sm:flex-row gap-md mt-lg w-full max-w-4xl">
    <Link
      to={`/customer/bookings/${orderId}`}
      className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-sm"
    >
      <Map aria-hidden="true" size={24} />
      Theo dõi đơn hàng
    </Link>
    <Link
      to="/customer"
      className="flex-1 py-4 bg-surface-container-high/50 text-primary border border-outline-variant/30 rounded-2xl font-bold hover:bg-surface-container-highest/20 transition-all active:scale-95 flex items-center justify-center gap-sm"
    >
      <House aria-hidden="true" size={24} />
      Về trang chủ
    </Link>
  </div>
);
