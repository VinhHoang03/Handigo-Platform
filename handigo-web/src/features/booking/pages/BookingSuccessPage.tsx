import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { useLocation, Navigate } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { BookingSuccessHero } from '../components/BookingSuccessHero';
import { BookingSuccessOrderCard } from '../components/BookingSuccessOrderCard';
import { BookingSuccessPaymentSummary } from '../components/BookingSuccessPaymentSummary';
import { BookingSuccessActions } from '../components/BookingSuccessActions';
import { BookingSuccessLocationPreview } from '../components/BookingSuccessLocationPreview';
import { BookingSuccessFooter } from '../components/BookingSuccessFooter';
import { BookingSuccessSkeleton } from '../components/BookingSuccessSkeleton';
import type { Order } from '../../../types/booking';
import { bookingApi } from '@/features/booking/api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import { AsyncState } from '@/components/common/AsyncState';

const formatAddress = (order: Order) => {
  const address = order.addressId;
  if (!address || typeof address === 'string') return '';
  const addressLine = [address.detailAddress, address.ward, address.district, address.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  return [address.label?.trim(), addressLine].filter(Boolean).join(': ');
};

const BookingSuccessPage = () => {
  const { addToast } = useToast();
  const notifiedOrderId = useRef<string | null>(null);
  const location = useLocation();
  const stateOrder = location.state?.order as Order | undefined;
  const fallbackOrderId = new URLSearchParams(location.search).get('orderId') || sessionStorage.getItem('latestBookingOrderId');
  const [order, setOrder] = useState<Order | null>(stateOrder ?? null);
  const [isLoading, setIsLoading] = useState(!stateOrder && Boolean(fallbackOrderId));
  const reset = useBookingStore(state => state.reset);

  useEffect(() => {
    if (stateOrder) {
      sessionStorage.removeItem('latestBookingOrderId');
      sessionStorage.removeItem('pendingBookingOrderId');
      sessionStorage.removeItem('pendingBookingFingerprint');
      reset();
      return;
    }

    const orderId = fallbackOrderId;

    if (!orderId) return;

    let isMounted = true;
    bookingApi.getOrderById(orderId)
      .then(data => {
        if (!isMounted) return;
        setOrder(data);
        sessionStorage.removeItem('latestBookingOrderId');
        sessionStorage.removeItem('pendingBookingOrderId');
        sessionStorage.removeItem('pendingBookingFingerprint');
        reset();
      })
      .catch(error => {
        console.error("Không thể tải đơn hàng đã thanh toán:", error);
        if (isMounted) addToast(getErrorMessage(error, 'Không thể tải thông tin đơn dịch vụ.'), 'error');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [addToast, fallbackOrderId, reset, stateOrder]);

  useEffect(() => {
    if (!order || notifiedOrderId.current === order._id) return;
    notifiedOrderId.current = order._id;
    addToast('Đã tạo đơn dịch vụ.', 'success');
  }, [addToast, order]);

  const addressText = order ? formatAddress(order) : '';

  return (
    <BookingShell>
      <main className="flex flex-col items-center justify-center py-lg">
        <AsyncState loading={isLoading} skeleton={<BookingSuccessSkeleton />}>
          {order ? (
            <>
              <BookingSuccessHero />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-md w-full max-w-4xl">
                <BookingSuccessOrderCard order={order} addressText={addressText} />
                <BookingSuccessPaymentSummary order={order} />
              </div>

              <BookingSuccessActions orderId={order._id} />
              <BookingSuccessLocationPreview />
              <BookingSuccessFooter />
            </>
          ) : (
            <Navigate to="/customer" replace />
          )}
        </AsyncState>
      </main>
    </BookingShell>
  );
};

export default BookingSuccessPage;
