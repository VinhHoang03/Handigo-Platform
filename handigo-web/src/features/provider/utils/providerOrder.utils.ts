import type { Order, OrderCustomer } from '@/types/booking';
import type { OrderAssignment } from '../types/providerOrder.types';

export const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const providerStatusLabels: Record<Order['status'], string> = {
  created: 'Chờ xử lý',
  accepted: 'Đã nhận',
  in_progress: 'Đang làm',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const providerStatusStyles: Record<Order['status'], string> = {
  created: 'border-primary text-primary bg-primary/5',
  accepted: 'border-accent-cyan text-accent-cyan bg-accent-cyan/5',
  in_progress: 'border-secondary text-secondary bg-secondary/5',
  completed: 'border-emerald-500 text-emerald-600 bg-emerald-50',
  cancelled: 'border-error text-error bg-error/5',
};

export function formatMoney(value?: number) {
  return currencyFormatter.format(value ?? 0);
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa chọn thời gian';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
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
