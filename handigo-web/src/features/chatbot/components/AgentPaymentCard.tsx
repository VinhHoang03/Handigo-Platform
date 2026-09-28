import { Link } from "react-router-dom";
import { tokenStorage } from "@/api/tokenStorage";
import type { AgentPayment } from "../types/agent.types";

function checkoutUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "payos.vn" || url.hostname.endsWith(".payos.vn")) ? url.href : undefined;
  } catch { return undefined; }
}

export function AgentPaymentCard({ payment, disabled, onCheck }: {
  payment: AgentPayment; disabled: boolean; onCheck: (orderId: string) => void;
}) {
  const url = payment.status === "pending" ? checkoutUrl(payment.checkoutUrl) : undefined;
  return <section aria-label="Thanh toán đơn hàng" className="space-y-3 rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 text-sm text-on-surface">
    <h3 className="font-semibold">Thanh toán đơn {payment.orderCode}</h3>
    <p className="text-xs leading-5 text-on-surface-variant">{payment.message}</p>
    {payment.amount != null && <p className="font-semibold text-primary">{payment.amount.toLocaleString("vi-VN")} đ</p>}
    <div className="flex flex-col gap-2">
      {url && !disabled && <a href={url} onClick={() => tokenStorage.prepareExternalRedirect()}
        className="rounded-xl bg-primary px-3 py-3 text-center font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Mở PayOS để thanh toán / hủy giao dịch</a>}
      <button type="button" disabled={disabled} onClick={() => onCheck(payment.orderId)}
        className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 font-medium hover:bg-surface-container-low disabled:opacity-50">Kiểm tra thanh toán</button>
      <div className="flex justify-between gap-3 text-xs font-medium text-primary">
        <Link to={`/customer/bookings/${payment.orderId}`}>Xem đơn hàng</Link>
        <Link to="/customer/wallet">Mở ví Handigo</Link>
      </div>
    </div>
  </section>;
}
