import { Link } from 'react-router-dom';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import type { Order } from '@/types/booking';
import { getOrderStatusMeta } from '@/utils/orderStatus';
import { toneBorderClasses, toneChipClasses } from '@/utils/statusTone';
import {
  formatDateTime,
  formatProviderOrderAmount,
  getCustomer,
  shortAddress,
} from '../utils/providerOrder.utils';
import { Clock } from "lucide-react";

export function ProviderOrderCard({ order }: { order: Order }) {
  const customer = getCustomer(order);
  const status = getOrderStatusMeta(order.status);

  return (
    <Link
      to={`/provider/orders/${order._id}`}
      className={`group flex flex-col gap-md rounded-2xl border-l-4 bg-surface-container-low p-md transition-all hover:-translate-y-0.5 hover:bg-surface-container-lowest sm:flex-row sm:items-center sm:justify-between ${toneBorderClasses[status.tone]}`}
    >
      <div className="flex min-w-0 items-center gap-md">
        <InitialsAvatar name={customer?.fullName || order.orderCode} src={customer?.avatar} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-bold text-on-surface">
              {order.serviceId?.name || 'Dịch vụ'}
            </h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneChipClasses[status.tone]}`}>
              {status.label}
            </span>
          </div>
          <p className="truncate text-sm text-on-surface-variant">
            {customer?.fullName || 'Khách hàng'}
            {shortAddress(order) ? ` · ${shortAddress(order)}` : ''}
          </p>
          <div className="mt-1 flex items-center gap-xs text-xs text-on-surface-variant">
            <Clock aria-hidden="true" size={14} />
            {formatDateTime(order.scheduledAt || order.createdAt)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-sm sm:block sm:text-right">
        <p className="font-bold tabular-nums text-primary">{formatProviderOrderAmount(order)}</p>
        <p className="text-xs text-on-surface-variant">{order.orderCode}</p>
      </div>
    </Link>
  );
}
