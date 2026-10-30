import type { Order } from '@/types/booking';
import { BookingStatusTimeline } from '@/features/booking/components/detail/BookingStatusTimeline';
import { buildOrderTimeline } from '@/features/booking/components/detail/bookingDetailTimeline';
import { getOrderStatusMeta } from '@/utils/orderStatus';

export function OrderProgressCard({ order }: { order: Order }) {
  const timeline = buildOrderTimeline(order);
  const hasSpecialHistory = order.status === 'cancelled' || (order.statusHistory ?? []).some(
    (event, index, history) => event.status === 'created' && (
      event.previousStatus === 'accepted'
      || (!event.previousStatus && history[index - 1]?.status === 'accepted')
    ),
  );
  const providerTimeline = hasSpecialHistory ? timeline : timeline.map((step, index) => ({
    ...step,
    title: ['Đã tạo đơn', 'Đã nhận đơn', 'Đang thực hiện', 'Hoàn thành'][index] || step.title,
    description: [
      'Đơn hàng đã được hệ thống ghi nhận.',
      step.state === 'pending' ? 'Đơn hàng đang chờ nhà cung cấp tiếp nhận.' : 'Bạn đã xác nhận tiếp nhận đơn hàng.',
      step.state === 'active'
        ? 'Bạn đang thực hiện công việc tại địa điểm khách hàng.'
        : step.state === 'done'
          ? 'Công việc đã được thực hiện.'
          : 'Bắt đầu theo lịch hẹn đã xác nhận.',
      step.state === 'done' ? 'Đơn hàng đã hoàn thành và được ghi nhận.' : 'Hoàn tất sau khi công việc được thực hiện.',
    ][index] || step.description,
  }));

  return <div className="min-w-0">
    <BookingStatusTimeline
      status={order.status}
      statusLabel={getOrderStatusMeta(order.status).label}
      timeline={providerTimeline}
    />
  </div>;
}
