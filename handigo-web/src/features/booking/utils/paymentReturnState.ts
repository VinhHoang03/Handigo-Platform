import type { Payment } from '@/types/booking';

export type PaymentReturnState = 'paid' | 'cancelled' | 'failed' | 'pending' | 'refunded';

export const getPaymentReturnState = (payment: Payment | null): PaymentReturnState => {
  if (!payment) return 'pending';
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'refunded') return 'refunded';
  if (payment.status === 'failed') {
    const link = payment.gatewayResponse?.paymentLink as { status?: string } | undefined;
    const check = payment.gatewayResponse?.statusCheck as { status?: string } | undefined;
    const reconciliation = payment.gatewayResponse?.reconciliation as { status?: string } | undefined;
    const status = reconciliation?.status ?? check?.status ?? link?.status;
    return typeof status === 'string' && status.toUpperCase() === 'CANCELLED' ? 'cancelled' : 'failed';
  }
  return 'pending';
};
