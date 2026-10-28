import { Link } from "react-router-dom";
import type { AgentPayment } from "../types/agent.types";
import { AgentPayosCheckout } from "./AgentPayosCheckout";
import { ArrowUpRight, ChevronDown, CreditCard } from "lucide-react";

export function AgentPaymentCard({ payment, disabled, onCheck, onChangeMethod, onCancel, onTopUp }: {
  payment: AgentPayment; disabled: boolean; onCheck: (orderId: string) => void;
  onChangeMethod?: (orderId: string) => void;
  onCancel?: (orderId: string, paymentId: string) => void;
  onTopUp?: () => void;
}) {
  const pendingPayos = payment.status === "pending" && (payment.method === "payos" || Boolean(payment.checkoutUrl));
  const canCheckPayment = ["pending", "cash_pending", "blocked", "failed"].includes(payment.status);
  const chooseMethod = ["unpaid", "failed"].includes(payment.status) && onChangeMethod;
  const topUp = payment.status === "blocked" && /ví/i.test(payment.message) && onTopUp;
  const terminal = ["paid", "deposit_paid", "refunded"].includes(payment.status);
  return <section aria-label="Thanh toán đơn hàng" className="space-y-4 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-4 text-sm text-on-surface shadow-[0_2px_8px_rgba(19,27,46,0.03)]">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><CreditCard size={19} aria-hidden="true" /></span>
      <div className="min-w-0"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Thanh toán dịch vụ</p><h3 className="break-words font-semibold">Thanh toán đơn {payment.orderCode}</h3></div>
    </div>
    {!pendingPayos && <p className="text-xs leading-5 text-on-surface-variant">{payment.message}</p>}
    {payment.amount != null && <p className="rounded-xl bg-primary/5 px-3 py-3 text-2xl font-semibold tracking-tight text-primary tabular-nums">{payment.amount.toLocaleString("vi-VN")} đ</p>}
    <div className="flex flex-col gap-2">
      {pendingPayos && <AgentPayosCheckout key={`${payment.orderId}:${payment.paymentId ?? "payos"}`} payment={payment} disabled={disabled} onCheck={onCheck} />}
      {topUp ? <button type="button" disabled={disabled} onClick={onTopUp}
        className="min-h-11 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Nạp ví cho đơn này</button> : chooseMethod ? <button type="button" disabled={disabled} onClick={() => onChangeMethod?.(payment.orderId)}
        className="min-h-11 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Chọn phương thức thanh toán</button> : canCheckPayment && <button type="button" disabled={disabled} onClick={() => onCheck(payment.orderId)}
        className="min-h-11 rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Kiểm tra thanh toán</button>}
      {terminal ? <Link className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" to={`/customer/bookings/${payment.orderId}`}>Xem đơn hàng<ArrowUpRight size={14} aria-hidden="true" /></Link> : <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-medium text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">Tùy chọn thanh toán<ChevronDown size={14} aria-hidden="true" className="group-open:rotate-180" /></summary>
        <div className="grid gap-2 pt-2">
          {(pendingPayos || ["cash_pending", "blocked"].includes(payment.status)) && onChangeMethod && <button type="button" disabled={disabled} onClick={() => onChangeMethod(payment.orderId)}
            className="min-h-11 rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Đổi phương thức thanh toán</button>}
          {pendingPayos && payment.paymentId && onCancel && <button type="button" disabled={disabled} onClick={() => onCancel(payment.orderId, payment.paymentId!)}
            className="min-h-11 rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy QR</button>}
          {(chooseMethod || topUp) && <button type="button" disabled={disabled} onClick={() => onCheck(payment.orderId)} className="min-h-11 px-3 text-xs text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Kiểm tra thanh toán</button>}
          <Link className="inline-flex min-h-11 items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" to={`/customer/bookings/${payment.orderId}`}>Xem đơn hàng<ArrowUpRight size={14} aria-hidden="true" /></Link>
          {(payment.method === "wallet" || payment.status === "blocked") && <Link className="inline-flex min-h-11 items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" to="/customer/wallet">Mở ví Handigo<ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </div>
      </details>}
    </div>
  </section>;
}
