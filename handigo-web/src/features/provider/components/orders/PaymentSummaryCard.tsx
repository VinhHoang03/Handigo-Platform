import type { Order } from '@/types/booking';
import type { QuotationDetail } from '../../types/providerOrder.types';
import { formatMoney, getPaymentMethodLabel } from '../../utils/providerOrder.utils';
import { CardTitle } from './CardTitle';

interface PaymentSummaryCardProps {
  order: Order;
  paymentStatus: string;
  quotation: QuotationDetail | null;
}

export function PaymentSummaryCard({ order, paymentStatus, quotation }: PaymentSummaryCardProps) {
  const discount = (order.pricing?.promotionDiscountAmount || 0) + (order.pricing?.voucherDiscountAmount || 0);
  const discountCode = order.voucherSnapshot?.code || order.promotionSnapshot?.code;
  const isQuotationOrder = Boolean(order.inspectionRequired);
  const quotationAmount = quotation?.quotation.finalAmount;
  const orderValue = isQuotationOrder
    ? quotationAmount === undefined
      ? 'Chưa báo giá'
      : formatMoney(quotationAmount)
    : formatMoney(order.pricing?.totalPaidAmount);
  const providerEarning = isQuotationOrder
    ? quotationAmount === undefined
      ? 'Chưa báo giá'
      : formatMoney(quotationAmount)
    : formatMoney(order.pricing?.providerEarningAmount);

  return (
    <section className="order-3 h-full rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg md:col-span-2 lg:order-2 lg:col-span-1">
      <CardTitle icon="account_balance_wallet" title="Thanh toán và thu nhập" />
      <div className="mt-md flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3">
        <span className="text-sm text-on-surface-variant">Trạng thái thanh toán</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{paymentStatus}</span>
      </div>
      <div className="mt-md space-y-3 text-sm">
        {isQuotationOrder && (
          <FinancialRow label="Tiền cọc đơn hàng" value={formatMoney(order.depositAmount)} />
        )}
        <FinancialRow label="Giá trị đơn hàng" value={orderValue} strong />
        {(order.cancellation?.refundPolicy?.providerCompensation || 0) > 0 && (
          <FinancialRow
            label="Bồi thường phí hủy"
            value={formatMoney(order.cancellation?.refundPolicy?.providerCompensation)}
            strong
          />
        )}
        {!isQuotationOrder && discountCode && <FinancialRow label="Mã giảm giá" value={discountCode} />}
        {!isQuotationOrder && <FinancialRow label="Số tiền giảm giá" value={`-${formatMoney(discount)}`} tone="discount" />}
        {!isQuotationOrder && <FinancialRow label="Phí nền tảng" value={`-${formatMoney(order.pricing?.platformCommissionAmount)}`} tone="fee" />}
        {!isQuotationOrder && <FinancialRow label="Tỷ lệ phí nền tảng" value={`${Math.round((order.pricing?.platformCommissionRate || 0) * 100)}%`} />}
        <FinancialRow
          label={isQuotationOrder ? 'Phương thức thanh toán tiền cọc' : 'Phương thức thanh toán'}
          value={getPaymentMethodLabel(order.paymentMethod)}
        />
      </div>
      <div className="mt-md rounded-2xl bg-success-container p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-on-success-container">Thu nhập thực nhận</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-on-success-container">{providerEarning}</p>
      </div>
    </section>
  );
}

function FinancialRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'discount' | 'fee';
}) {
  const valueColor = tone === 'discount' ? 'text-success' : tone === 'fee' ? 'text-error' : 'text-on-surface';
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`text-right tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${valueColor}`}>{value}</span>
    </div>
  );
}
