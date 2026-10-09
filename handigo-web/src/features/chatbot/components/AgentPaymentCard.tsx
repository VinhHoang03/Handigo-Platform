import { Link } from "react-router-dom";
import type { AgentPayment } from "../types/agent.types";
import { AgentPayosCheckout } from "./AgentPayosCheckout";

export function AgentPaymentCard({ payment, disabled, onCheck }: {
  payment: AgentPayment; disabled: boolean; onCheck: (orderId: string) => void;
}) {
  const pendingPayos = payment.status === "pending" && (payment.method === "payos" || Boolean(payment.checkoutUrl));
  const canCheckPayment = ["pending", "cash_pending", "blocked", "failed"].includes(payment.status);
  return <section aria-label="Thanh toán đơn hàng" className="space-y-3 rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 text-sm text-on-surface">
    <h3 className="font-semibold">Thanh toán đơn {payment.orderCode}</h3>
    {!pendingPayos && <p className="text-xs leading-5 text-on-surface-variant">{payment.message}</p>}
    {payment.amount != null && <p className="font-semibold text-primary">{payment.amount.toLocaleString("vi-VN")} đ</p>}
    <div className="flex flex-col gap-2">
      {pendingPayos && <AgentPayosCheckout key={`${payment.orderId}:${payment.paymentId ?? "payos"}`} payment={payment} disabled={disabled} onCheck={onCheck} />}
      {canCheckPayment && <button type="button" disabled={disabled} onClick={() => onCheck(payment.orderId)}
        className="min-h-11 rounded-xl border border-outline-variant px-3 py-2 font-medium hover:bg-surface-container-low disabled:opacity-50">Kiểm tra thanh toán</button>}
      <div className="flex justify-between gap-3 text-xs font-medium text-primary">
        <Link to={`/customer/bookings/${payment.orderId}`}>Xem đơn hàng</Link>
        <Link to="/customer/wallet">Mở ví Handigo</Link>
      </div>
    </div>
  </section>;
}
