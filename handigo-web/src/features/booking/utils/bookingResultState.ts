import type { Order, Payment } from '@/types/booking';
import { getPaymentReturnState, type PaymentReturnState } from './paymentReturnState';

export type BookingResultState = PaymentReturnState | 'booked' | 'order_cancelled' | 'error';

export const getBookingResultState = (order: Order, payment: Payment | null): BookingResultState => {
  if (order.paymentStatus === 'refunded') return 'refunded';
  if (order.status === 'cancelled') return 'order_cancelled';
  if (order.paymentStatus === 'paid') return 'paid';
  if (payment?.method === 'cash' && payment.status === 'pending') return 'booked';
  if (payment) return getPaymentReturnState(payment);
  if (order.inspectionRequired && order.paymentStatus === 'partially_paid' && order.depositPaidAt) return 'paid';
  return getPaymentReturnState(payment);
};
