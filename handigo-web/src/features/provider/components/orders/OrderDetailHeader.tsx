import type { Order } from '@/types/booking';
import { OrderChatButton } from '@/features/chat/components/OrderChatButton';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { toneOutlineClasses } from '@/utils/statusTone';

export function OrderDetailHeader({ order }: { order: Order }) {
  const status = getOrderStatusMeta(order.status);

  return (
    <header className="flex flex-col gap-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:flex-row sm:items-center sm:justify-between sm:p-lg">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Chi tiết đơn dịch vụ</p>
        <h1 className="mt-1 break-words font-headline-lg text-headline-lg text-on-surface">
          {order.serviceId?.name || 'Chi tiết đơn dịch vụ'}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">Theo dõi thông tin, tài chính và tiến độ trên cùng một màn hình.</p>
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold ${toneOutlineClasses[status.tone]}`}>
          {status.label}
        </span>
        {['accepted', 'in_progress'].includes(order.status) && <OrderChatButton orderId={order._id} />}
      </div>
    </header>
  );
}
