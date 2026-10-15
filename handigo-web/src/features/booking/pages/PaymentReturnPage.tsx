import { Navigate, useLocation } from 'react-router-dom';

export default function PaymentReturnPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('orderId');
  const isCancelled = location.pathname === '/payment/cancel' || params.get('payos') === 'cancel';
  if (isCancelled && orderId && /^[a-f\d]{24}$/i.test(orderId)) {
    return <Navigate to={`/customer/bookings/${orderId}?payos=cancel`} replace />;
  }
  return <Navigate to={`/customer/bookings/result${location.search}`} state={location.state} replace />;
}
