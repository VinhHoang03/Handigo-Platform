import { Navigate, useLocation } from 'react-router-dom';

export default function PaymentReturnPage() {
  const location = useLocation();
  return <Navigate to={`/customer/bookings/result${location.search}`} state={location.state} replace />;
}
