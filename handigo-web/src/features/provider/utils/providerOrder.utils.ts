import type { Order, OrderCustomer } from '@/types/booking';
import type { OrderAssignment } from '../types/providerOrder.types';

export const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatMoney(value?: number) {
  return currencyFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
}

export function formatProviderOrderAmount(order: Order) {
  if (order.inspectionRequired) {
    return typeof order.quotationFinalAmount === 'number'
      ? formatMoney(order.quotationFinalAmount)
      : 'Chưa báo giá';
  }
  return formatMoney(order.pricing?.providerEarningAmount);
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa chọn thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa chọn thời gian';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getCustomer(order: Order): OrderCustomer | null {
  return typeof order.customerId === 'object' ? order.customerId : null;
}

export function shortAddress(order: Order) {
  const address = order.addressId;
  if (!address) return '';
  return [address.ward, address.province].filter(Boolean).join(', ');
}

export function getOrderFromAssignment(assignment: OrderAssignment): Order | null {
  return typeof assignment.orderId === 'object' ? assignment.orderId : null;
}

export function getPaymentMethodLabel(method: string) {
  switch (method) {
    case 'wallet':
      return 'Ví HandiGo';
    case 'bank':
      return 'Chuyển khoản QR';
    case 'cash':
      return 'Tiền mặt';
    default:
      return method;
  }
}

export function getAssignmentCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Hết hạn';
  const seconds = Math.floor(diff / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
