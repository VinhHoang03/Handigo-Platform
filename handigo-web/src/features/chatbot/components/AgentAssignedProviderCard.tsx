import { useState } from "react";
import { Link } from "react-router-dom";
import { OrderChatButton } from "@/features/chat/components/OrderChatButton";
import { OrderTrackingMap } from "@/features/tracking/components/OrderTrackingMap";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import type { AgentAssignedProvider, AgentSend } from "../types/agent.types";
import { ChevronDown } from "lucide-react";

export function AgentAssignedProviderCard({ value, disabled, onSend }: {
  value: AgentAssignedProvider; disabled: boolean; onSend: AgentSend;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const showMap = async () => {
    setLoading(true); setError("");
    try { setOrder(await bookingApi.getOrderById(value.orderId)); }
    catch (failure) { setError(getErrorMessage(failure, "Chưa tải được vị trí thợ. Vui lòng thử lại.")); }
    finally { setLoading(false); }
  };
  return <section aria-label="Thợ thực hiện đơn đang xem" className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 text-sm">
    <h3 className="font-semibold">Thợ thực hiện · {value.orderCode}</h3>
    <p className="mt-2">{value.provider?.name ?? value.message}</p>
    {value.provider && <p className="mt-1 text-xs text-on-surface-variant">{value.provider.averageRating.toLocaleString("vi-VN")} sao · {value.provider.totalCompletedOrders} đơn hoàn thành</p>}
    <p className="mt-2 text-xs text-on-surface-variant">Kiểm tra lúc {new Date(value.checkedAt).toLocaleString("vi-VN")}. {value.trackingMessage}</p>
    {value.location && <p className="mt-1 text-xs">Vị trí cập nhật lúc {new Date(value.location.updatedAt).toLocaleString("vi-VN")}. Mở bản đồ để theo dõi.</p>}
    <div className="mt-3 space-y-2">
      {value.canContact && <OrderChatButton orderId={value.orderId} disabled={disabled} />}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-medium text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">Liên hệ và theo dõi<ChevronDown size={14} aria-hidden="true" className="group-open:rotate-180" /></summary>
        <div className="grid gap-2 pt-2">
          {value.canContact && value.provider?.phone && <a href={`tel:${value.provider.phone}`} className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary">Gọi {value.provider.phone}</a>}
          {value.canTrack && <button type="button" disabled={disabled || loading} onClick={() => { void showMap(); }} className="min-h-11 rounded-xl border border-outline-variant px-3 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{loading ? "Đang tải vị trí…" : "Xem vị trí thợ"}</button>}
          <button type="button" disabled={disabled} onClick={() => { void onSend(`Kiểm tra lại thợ thực hiện đơn ${value.orderCode}.`, undefined, { type: "provider", orderId: value.orderId }).catch(() => undefined); }} className="min-h-11 px-3 text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Làm mới</button>
          <Link to={`/customer/bookings/${value.orderId}`} className="min-h-11 px-3 py-2 text-primary focus-visible:outline-2 focus-visible:outline-primary">Chi tiết đơn</Link>
        </div>
      </details>
    </div>
    {error && <p role="alert" className="mt-2 text-error">{error}</p>}
    {order && <div className="mt-3"><OrderTrackingMap order={order} viewerRole="CUSTOMER" compact /></div>}
  </section>;
}
