import type { Order } from '@/types/booking';
import { BookingStatusTimeline } from '@/features/booking/components/detail/BookingStatusTimeline';
import { buildOrderTimeline } from '@/features/booking/components/detail/bookingDetailTimeline';
import { getOrderStatusMeta } from '@/utils/orderStatus';

export function OrderProgressCard({ order }: { order: Order }) {
  return <div className="order-2 min-w-0 lg:order-3">
    <BookingStatusTimeline status={order.status} statusLabel={getOrderStatusMeta(order.status).label} timeline={buildOrderTimeline(order)} />
  </div>;
}
