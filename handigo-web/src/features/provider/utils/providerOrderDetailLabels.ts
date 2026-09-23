import type { Order } from '@/types/booking';

/** Nhãn hiển thị dành riêng cho trang chi tiết đơn dịch vụ của thợ. */
export const paymentStatusLabels: Record<Order['paymentStatus'], string> = {
  unpaid: 'Chưa thanh toán',
  partially_paid: 'Đã thanh toán tiền cọc',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

export const orderTypeLabels: Record<Order['orderType'], string> = {
  normal: 'Thực hiện sớm nhất',
  urgent: 'Khẩn cấp',
  scheduled: 'Theo lịch hẹn',
  recurring: 'Định kỳ',
};

export function getPaymentStatusLabel(order: Order) {
  if (order.status === 'cancelled' && ['paid', 'partially_paid'].includes(order.paymentStatus)) {
    return 'Đang xử lý hoàn tiền';
  }
  if (
    order.status === 'cancelled' &&
    order.paymentStatus === 'refunded' &&
    order.cancellation?.refundPolicy &&
    order.cancellation.refundPolicy.refundRate < 100
  ) {
    return `Đã hoàn ${order.cancellation.refundPolicy.refundRate}% cho khách`;
  }
  return paymentStatusLabels[order.paymentStatus];
}
