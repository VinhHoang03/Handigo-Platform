import { useEffect, useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { Pagination } from "@/components/common/Pagination";
import { ChartCard, ChartDataTable, chartMoney } from "@/components/common/chart";
import { getErrorMessage } from "@/utils/apiError";
import { adminOperationsApi } from "../../api/adminOperations.api";
import type { AdminPayment, Paginated, PaymentMethod } from "../../types/adminOperations.types";
import type { AdminRevenueInsights, RevenueQuery } from "../../types/adminRevenue.types";
import { RevenuePaymentChannels } from './RevenuePaymentChannels';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, paymentDateTime } from "../payments/payment-constants";
import { AdminFeedbackDetailModal } from "../feedback/AdminFeedbackDetailModal";

export function RevenuePayments({ range, initialMethod = '', channels }: { range: RevenueQuery; initialMethod?: PaymentMethod | ''; channels?: AdminRevenueInsights['channels'] }) {
  const [mode, setMode] = useState<"paidAt" | "refundedAt">("paidAt");
  const [method, setMethod] = useState<PaymentMethod | "">(initialMethod);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<(Paginated<AdminPayment> & { totalOrders?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void adminOperationsApi.payments({ ...range, page, limit: 20, dateField: mode,
        ...(mode === "refundedAt" ? { status: "refunded" as const } : {}), ...(method ? { method } : {}) })
        .then(data => { if (active) setResult(data); })
        .catch(cause => { if (active) setError(getErrorMessage(cause, "Không thể tải giao dịch thanh toán.")); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [range, mode, method, page, attempt]);

  return <div id="revenue-payments" className="scroll-mt-28">
    <ChartCard title={channels ? "Dòng tiền theo kênh thanh toán" : "Chi tiết thu tiền và hoàn tiền"}>
      {channels && <RevenuePaymentChannels channels={channels} selectedMethod={method} showHeading={false} onSelect={value => {
        if (!Object.hasOwn(PAYMENT_METHOD_LABELS, value)) return;
        setMethod(value as PaymentMethod); setMode('paidAt'); setPage(1);
      }} />}
      <div className={`mb-4 flex flex-wrap items-center gap-2 ${channels ? 'mt-5 border-t border-outline-variant/30 pt-4' : ''}`}>
        {([['paidAt', 'Tiền đã thu'], ['refundedAt', 'Tiền đã hoàn']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value}
          onClick={() => { setMode(value); setPage(1); }} className={`min-h-11 rounded-xl border px-4 text-sm ${mode === value ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant'}`}>{label}</button>)}
        <select aria-label="Phương thức thanh toán" value={method} onChange={event => { setMethod(event.target.value as PaymentMethod | ""); setPage(1); }} className="min-h-11 rounded-xl border border-outline-variant px-3 text-sm">
          <option value="">Tất cả phương thức</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <p className="ml-auto text-sm text-on-surface-variant" aria-live="polite">{loading ? 'Đang tải…' : !error && <><strong className="text-on-surface">{(result?.totalOrders ?? 0).toLocaleString('vi-VN')}</strong> đơn · {(result?.pagination.total ?? 0).toLocaleString('vi-VN')} giao dịch</>}</p>
      </div>
      <AsyncState loading={loading} error={error} empty={!result?.items.length} emptyMessage="Không có giao dịch trong khoảng ngày này." onRetry={() => setAttempt(value => value + 1)}>
        {result && <>
          <ChartDataTable caption="Giao dịch trong khoảng ngày đã chọn" columns={["Thời gian", "Mã đơn", "Loại", "Phương thức", "Số tiền", "Trạng thái"]}
            rows={result.items.map(payment => [
              paymentDateTime.format(new Date((mode === "refundedAt" ? payment.refundedAt : payment.paidAt) || payment.createdAt)),
              <button type="button" onClick={() => setOrderId(payment.orderId)} className="min-h-11 font-semibold text-primary hover:underline" title="Xem chi tiết đơn hàng">{payment.orderCode || `Đơn #${String(payment.orderId).slice(-6).toUpperCase()}`}</button>,
              PAYMENT_TYPE_LABELS[payment.paymentType], PAYMENT_METHOD_LABELS[payment.method],
              chartMoney.format(mode === "refundedAt" ? payment.metadata?.refund?.amount ?? payment.amount : payment.amount), PAYMENT_STATUS_LABELS[payment.status],
            ])} />
          <Pagination page={page} totalPages={result.pagination.totalPages} onChange={setPage} />
        </>}
      </AsyncState>
    </ChartCard>
    {orderId && <AdminFeedbackDetailModal key={orderId} orderId={orderId} onClose={() => setOrderId(null)} />}
  </div>;
}
