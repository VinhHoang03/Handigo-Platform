import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getErrorMessage } from '@/utils/apiError';
import { BookingShell } from '../components/BookingComponents';
import { BookingSuccessHero } from '../components/BookingSuccessHero';
import { BookingSuccessOrderCard } from '../components/BookingSuccessOrderCard';
import { BookingSuccessPaymentSummary } from '../components/BookingSuccessPaymentSummary';
import { BookingSuccessActions } from '../components/BookingSuccessActions';
import { BookingSuccessLocationPreview } from '../components/BookingSuccessLocationPreview';
import { BookingSuccessFooter } from '../components/BookingSuccessFooter';
import { BookingSuccessSkeleton } from '../components/BookingSuccessSkeleton';
import type { Order, OrderQuotation, Payment } from '@/types/booking';
import { bookingApi } from '../api/booking.api';
import { useBookingStore } from '../hooks/useBookingStore';
import { AsyncState } from '@/components/common/AsyncState';
import { getBookingResultState, type BookingResultState } from '../utils/bookingResultState';
import { PENDING_ORDER_ID_KEY, PENDING_ORDER_FINGERPRINT_KEY } from '../components/confirmPaymentSubmit';
import { formatOrderAddress } from '../components/detail/bookingDetailProvider';

const formatAddress = (order: Order) => {
  const address = order.addressId;
  if (!address || typeof address === 'string') return '';
  const addressLine = formatOrderAddress(order);
  return [address.label?.trim(), addressLine].filter(Boolean).join(': ');
};

const BookingResultPage = () => {
  const location = useLocation();
  const stateOrder = location.state?.order as Order | undefined;
  const orderId = new URLSearchParams(location.search).get('orderId') || stateOrder?._id || sessionStorage.getItem('latestBookingOrderId') || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [result, setResult] = useState<BookingResultState>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [quotation, setQuotation] = useState<OrderQuotation | null>(null);
  const [quotationError, setQuotationError] = useState('');
  const reset = useBookingStore(state => state.reset);
  const request = useRef(0);

  const check = useCallback(async () => {
    const currentRequest = ++request.current;
    setIsLoading(true);
    setError('');
    setVerificationError('');
    setQuotation(null);
    setQuotationError('');
    setOrder(null);
    try {
      if (!/^[a-f\d]{24}$/i.test(orderId)) throw new Error('Không tìm thấy mã đơn hợp lệ. Vui lòng mở lịch sử đơn hàng.');
      let currentOrder = await bookingApi.getOrderById(orderId);
      let payment: Payment | null = null;
      let failureMessage = '';
      try {
        if (currentOrder.paymentMethod === 'bank' && currentOrder.paymentStatus !== 'paid' && currentOrder.paymentStatus !== 'refunded') {
          const reconciled = await bookingApi.reconcilePayosPayment(orderId);
          currentOrder = await bookingApi.getOrderById(orderId);
          payment = reconciled.payment;
          if (!payment || currentOrder.paymentStatus === 'partially_paid') {
            const payments = await bookingApi.getPaymentsByOrder(orderId);
            payment = payments.payments.find(item => item.method === 'payos') ?? payment;
          }
        } else if (currentOrder.paymentMethod === 'cash' && currentOrder.paymentStatus === 'unpaid') {
          const payments = await bookingApi.getPaymentsByOrder(orderId);
          payment = payments.payments.find(item => item.method === 'cash' && item.status === 'pending') ?? null;
        }
      } catch (failure) {
        failureMessage = getErrorMessage(failure, 'Chưa thể xác minh thanh toán. Vui lòng kiểm tra lại.');
      }
      let currentQuotation: OrderQuotation | null = null;
      let quotationFailure = '';
      if (currentOrder.inspectionRequired || currentOrder.serviceId.serviceType === 'variable_price') {
        try { currentQuotation = await bookingApi.getQuotation(orderId); }
        catch (failure) { quotationFailure = getErrorMessage(failure, 'Chưa tải được báo giá. Vui lòng kiểm tra lại hoặc mở chi tiết đơn.'); }
      }
      if (currentRequest !== request.current) return;
      const next = currentOrder.status === 'cancelled'
        ? getBookingResultState(currentOrder, payment)
        : failureMessage ? 'error' : getBookingResultState(currentOrder, payment);
      setOrder(currentOrder);
      setResult(next);
      setVerificationError(failureMessage);
      setQuotation(currentQuotation);
      setQuotationError(quotationFailure);
      if (next === 'paid' || next === 'booked') {
        if (sessionStorage.getItem(PENDING_ORDER_ID_KEY) === orderId) {
          sessionStorage.removeItem(PENDING_ORDER_ID_KEY);
          sessionStorage.removeItem(PENDING_ORDER_FINGERPRINT_KEY);
          reset();
        }
        if (sessionStorage.getItem('latestBookingOrderId') === orderId) sessionStorage.removeItem('latestBookingOrderId');
      }
    } catch (failure) {
      if (currentRequest === request.current) setError(getErrorMessage(failure, 'Không thể tải thông tin đơn dịch vụ.'));
    } finally {
      if (currentRequest === request.current) setIsLoading(false);
    }
  }, [orderId, reset]);

  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void check(), 0);
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [check, invalidate]);

  const successful = result === 'paid' || result === 'booked';
  return (
    <BookingShell>
      <main className="flex flex-col items-center pt-0 pb-0" aria-live="polite">
        <AsyncState loading={isLoading} error={error} onRetry={() => void check()} skeleton={<BookingSuccessSkeleton />}>
          {order && <>
            <BookingSuccessHero result={result} description={result === 'error' ? verificationError || undefined : undefined} />
            {verificationError && result !== 'error' && <p role="alert" className="mb-3 w-full max-w-4xl rounded-xl border border-warning/30 bg-warning-container/50 px-4 py-3 text-sm text-on-surface">Chưa xác minh được giao dịch hoặc thông tin hoàn tiền. {verificationError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-4xl">
              <BookingSuccessOrderCard order={order} addressText={formatAddress(order)} />
              <BookingSuccessPaymentSummary order={order} result={result} quotation={quotation} quotationError={quotationError} />
            </div>
            {(result === 'pending' || result === 'error' || verificationError || quotationError) && <button type="button" onClick={() => void check()} className="mt-3 rounded-xl border border-outline-variant px-4 py-2 text-sm text-primary hover:bg-surface-container-low">Kiểm tra lại kết quả</button>}
            <BookingSuccessActions orderId={order._id} retryPayment={order.status !== 'cancelled' && ['pending', 'cancelled', 'failed', 'error'].includes(result)} />
            {successful && order.status === 'created' && !order.providerId && <BookingSuccessLocationPreview />}
            <BookingSuccessFooter />
          </>}
        </AsyncState>
        {!isLoading && error && <Link to="/customer/bookings" className="mt-md text-primary underline">Mở lịch sử đơn hàng</Link>}
      </main>
    </BookingShell>
  );
};

export default BookingResultPage;
