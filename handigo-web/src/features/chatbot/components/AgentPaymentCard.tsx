import { Link } from "react-router-dom";
import type { AgentPayment } from "../types/agent.types";
import { AgentPayosCheckout } from "./AgentPayosCheckout";
import { ArrowUpRight, CreditCard } from "lucide-react";

export function AgentPaymentCard({ payment, disabled, onCheck, onChangeMethod }: {
  payment: AgentPayment; disabled: boolean; onCheck: (orderId: string) => void;
  onChangeMethod?: (orderId: string) => void;
}) {
  const pendingPayos = payment.status === "pending" && (payment.method === "payos" || Boolean(payment.checkoutUrl));
  const canCheckPayment = ["pending", "cash_pending", "blocked", "failed"].includes(payment.status);
  return <section aria-label="Thanh toán đơn hàng" className="space-y-4 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-4 text-sm text-on-surface shadow-[0_2px_8px_rgba(19,27,46,0.03)]">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><CreditCard size={19} aria-hidden="true" /></span>
      <div className="min-w-0"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Thanh toán dịch vụ</p><h3 className="break-words font-semibold">Thanh toán đơn {payment.orderCode}</h3></div>
    </div>
    {!pendingPayos && <p className="text-xs leading-5 text-on-surface-variant">{payment.message}</p>}
    {payment.amount != null && <p className="rounded-xl bg-primary/5 px-3 py-3 text-2xl font-semibold tracking-tight text-primary tabular-nums">{payment.amount.toLocaleString("vi-VN")} đ</p>}
    <div className="flex flex-col gap-2">
      {pendingPayos && <AgentPayosCheckout key={`${payment.orderId}:${payment.paymentId ?? "payos"}`} payment={payment} disabled={disabled} onCheck={onCheck} />}
      {(pendingPayos || payment.status === "cash_pending") && onChangeMethod && <button type="button" disabled={disabled} onClick={() => onChangeMethod(payment.orderId)}
        className="min-h-11 rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Đổi phương thức thanh toán</button>}
      {canCheckPayment && <button type="button" disabled={disabled} onClick={() => onCheck(payment.orderId)}
        className="min-h-11 rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Kiểm tra thanh toán</button>}
      <div className="flex flex-wrap justify-between gap-x-3 text-xs font-medium text-primary">
        <Link className="inline-flex min-h-11 items-center gap-1 hover:underline focus-visible:outline-2 focus-visible:outline-primary" to={`/customer/bookings/${payment.orderId}`}>Xem đơn hàng<ArrowUpRight size={14} aria-hidden="true" /></Link>
        <Link className="inline-flex min-h-11 items-center gap-1 hover:underline focus-visible:outline-2 focus-visible:outline-primary" to="/customer/wallet">Mở ví Handigo<ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
    </div>
  </section>;
}
