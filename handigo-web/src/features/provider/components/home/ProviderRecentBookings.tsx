import { Link } from "react-router-dom";
import type { Order } from "@/types/booking";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { Skeleton } from "@/components/common/Skeleton";
import { formatProviderOrderAmount } from "../../utils/providerOrder.utils";
import {
  formatDateTime,
  getCustomer,
  shortAddress,
  statusLabels,
  statusStyles,
} from "./providerHome.utils";

function BookingItem({ order }: { order: Order }) {
  const customer = getCustomer(order);

  return (
    <Link
      to={`/provider/orders/${order._id}`}
      className={`group flex flex-col gap-md rounded-2xl border-l-4 bg-surface-container-low p-md transition-all hover:bg-surface-container-lowest sm:flex-row sm:items-center sm:justify-between ${statusStyles[order.status]}`}
    >
      <div className="flex min-w-0 items-center gap-md">
        <InitialsAvatar
          name={customer?.fullName || order.orderCode}
          src={customer?.avatar}
          className="h-12 w-12"
        />
        <div className="min-w-0">
          <h4 className="truncate font-bold text-on-surface">
            {customer?.fullName || "Khách hàng"}
          </h4>
          <p className="truncate text-sm text-on-surface-variant">
            {order.serviceId.name}
            {shortAddress(order) ? ` - ${shortAddress(order)}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
              schedule
            </span>
            <span className="text-xs text-on-surface-variant">
              {formatDateTime(order.scheduledAt || order.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-sm sm:block sm:text-right">
        <p className="font-bold text-primary tabular-nums">
          {formatProviderOrderAmount(order)}
        </p>
        <span className="text-[10px] font-bold uppercase tracking-tight">
          {statusLabels[order.status]}
        </span>
      </div>
    </Link>
  );
}

interface ProviderRecentBookingsProps {
  recentOrders: Order[];
  isLoadingOrders: boolean;
  ordersError: string | null;
}

export function ProviderRecentBookings({
  recentOrders,
  isLoadingOrders,
  ordersError,
}: ProviderRecentBookingsProps) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-md">
      <div className="mb-md flex items-center justify-between">
        <h3 className="font-headline-md text-on-surface">Booking gần nhất</h3>
        <Link
          to="/provider/orders"
          className="font-label-md text-primary hover:underline"
        >
          Xem tất cả
        </Link>
      </div>

      <div className="space-y-sm">
        {isLoadingOrders && (
          <div className="space-y-sm" role="status" aria-busy="true" aria-label="Đang tải booking gần nhất">
            <Skeleton className="h-20 w-full" rounded="rounded-2xl" />
            <Skeleton className="h-20 w-full" rounded="rounded-2xl" />
          </div>
        )}
        {!isLoadingOrders && ordersError && (
          <div className="rounded-2xl bg-error-container p-md text-on-error-container">
            {ordersError}
          </div>
        )}
        {!isLoadingOrders && !ordersError && recentOrders.length === 0 && (
          <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
            Chưa có booking nào được phân công cho bạn.
          </div>
        )}
        {!isLoadingOrders &&
          !ordersError &&
          recentOrders.map((order) => (
            <BookingItem key={order._id} order={order} />
          ))}
      </div>
    </div>
  );
}
