import { CalendarDays, Wrench } from 'lucide-react';
import type { FeedbackOrder, PersonRef } from '../types/feedback.types';

const getProviderName = (order: FeedbackOrder) => {
  if (!order.providerId || typeof order.providerId === 'string') return 'Chưa có thợ';
  const provider = order.providerId as PersonRef & { userId?: PersonRef };
  return provider.userId?.fullName || provider.fullName || 'Thợ dịch vụ';
};

export function OrderFeedbackSummary({ order }: { order: FeedbackOrder }) {
  const serviceName = typeof order.serviceId === 'string' ? 'Dịch vụ' : order.serviceId.name || 'Dịch vụ';
  return (
    <section className="mb-6 grid gap-3 rounded-lg bg-surface-container-low p-4 sm:grid-cols-2">
      <div><p className="text-xs text-on-surface-variant">Mã đơn hàng</p><p className="font-bold">{order.orderCode}</p></div>
      <div><p className="text-xs text-on-surface-variant">Trạng thái</p><p className="font-bold">{order.status === 'completed' ? 'Đã hoàn tất' : order.status}</p></div>
      <p className="flex items-center gap-2"><Wrench size={17} /> {serviceName} · {getProviderName(order)}</p>
      <p className="flex items-center gap-2"><CalendarDays size={17} /> {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
    </section>
  );
}
