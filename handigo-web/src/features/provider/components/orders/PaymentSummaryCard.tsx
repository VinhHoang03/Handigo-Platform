import type { Order } from '@/types/booking';
import { getAppliedQuotationDeposit, getDirectRepairPayment, isQuotationPaidOnline } from '@/utils/quotationPayment';
import type { QuotationDetail } from '../../types/providerOrder.types';
import { formatMoney, getPaymentMethodLabel } from '../../utils/providerOrder.utils';
import { CardTitle } from './CardTitle';
import { Wallet } from "lucide-react";

interface PaymentSummaryCardProps {
  order: Order;
  paymentStatus: string;
  quotation: QuotationDetail | null;
}

export function PaymentSummaryCard({ order, paymentStatus, quotation }: PaymentSummaryCardProps) {
  const discount = (order.pricing?.promotionDiscountAmount || 0) + (order.pricing?.voucherDiscountAmount || 0);
  const isQuotationOrder = Boolean(order.inspectionRequired || order.serviceId?.serviceType === 'variable_price');
  const isCancelled = order.status === 'cancelled';
  const isCash = order.paymentMethod === 'cash';
  const repairQuotation = quotation?.quotation;
  const quotationAmount = repairQuotation?.finalAmount;
  const appliedDepositAmount = getAppliedQuotationDeposit(order);
  const directRepairAmount = quotationAmount === undefined
    ? undefined : getDirectRepairPayment(quotationAmount, appliedDepositAmount);
  const displayedPaymentStatus = !isQuotationOrder && !isCancelled && isCash
    ? order.paymentStatus === 'paid' ? 'Đã thu tiền mặt' : 'Chưa thu tiền'
    : paymentStatus;
  const paymentMethod = order.paymentMethod === 'bank' ? 'QR PayOS' : getPaymentMethodLabel(order.paymentMethod);
  const isQuotationOnlinePaid = isQuotationPaidOnline(order, repairQuotation);
  const quotationPaymentMethod = repairQuotation?.directPaymentConfirmedAt ? 'Thanh toán trực tiếp'
    : isQuotationOnlinePaid ? order.paymentMethod === 'bank' ? 'QR PayOS' : 'Ví Handigo' : null;
  const paymentCompleted = displayedPaymentStatus?.startsWith('Đã') ?? false;

  return (
    <section className="order-3 h-full rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg md:col-span-2 lg:order-2 lg:col-span-1">
      <CardTitle icon={Wallet} title="Thanh toán đơn hàng" />
      <dl className="mt-md space-y-3 text-sm">
        {displayedPaymentStatus && <FinancialRow label={isQuotationOrder && !isQuotationOnlinePaid && !repairQuotation?.directPaymentConfirmedAt ? 'Trạng thái tiền cọc' : 'Trạng thái thanh toán'} value={displayedPaymentStatus} tone={paymentCompleted ? 'success' : 'primary'} badge />}
        {isQuotationOrder && (
          <>
            <FinancialRow label="Tiền cọc đã thanh toán" value={formatMoney(appliedDepositAmount)} tone="success" />
            <FinancialRow label="Giá trị đơn hàng" value={quotationAmount === undefined ? '' : formatMoney(quotationAmount)} tone="primary" total />
            {quotationAmount !== undefined && !isCancelled && (
              <>
                <FinancialRow
                  label={repairQuotation?.directPaymentConfirmedAt ? 'Đã thu trực tiếp từ khách'
                    : isQuotationOnlinePaid ? order.paymentMethod === 'bank' ? 'Đã thanh toán qua QR PayOS' : 'Đã thanh toán qua ví' : 'Còn cần thanh toán'}
                  value={formatMoney(directRepairAmount)}
                  tone={repairQuotation?.directPaymentConfirmedAt || isQuotationOnlinePaid ? 'success' : 'primary'}
                  total
                />
              </>
            )}
          </>
        )}
        {!isQuotationOrder && (
          <>
            <FinancialRow label="Giá trị dịch vụ" value={formatMoney(order.pricing.bookingAmount)} />
            {discount > 0 && <FinancialRow label="Giảm giá" value={`-${formatMoney(discount)}`} tone="success" />}
            <FinancialRow label="Tổng tiền khách phải trả" value={formatMoney(order.pricing.totalPaidAmount)} tone="primary" total />
          </>
        )}
        {isQuotationOrder ? quotationPaymentMethod && (
          <FinancialRow label="Phương thức thanh toán" value={quotationPaymentMethod} tone="primary" badge />
        ) : (
          <FinancialRow label="Phương thức" value={paymentMethod} tone="primary" badge />
        )}
      </dl>
      {!isQuotationOrder && !isCancelled && !isCash && order.paymentStatus === 'paid' && (
        <p className="mt-3 text-xs text-on-surface-variant">Khách đã thanh toán trực tuyến. Không thu thêm tiền mặt từ khách.</p>
      )}
    </section>
  );
}

function FinancialRow({
  label,
  value,
  total,
  tone = 'default',
  badge = false,
}: {
  label: string;
  value: string;
  total?: boolean;
  tone?: 'default' | 'primary' | 'success';
  badge?: boolean;
}) {
  const valueTone = tone === 'success'
    ? 'text-emerald-700'
    : tone === 'primary'
      ? 'text-primary'
      : 'text-on-surface';
  const badgeTone = tone === 'success'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-primary/10 text-primary';

  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
      <dt className={total ? 'font-bold text-on-surface' : 'text-on-surface-variant'}>{label}</dt>
      <dd className={`min-w-0 break-words text-right tabular-nums ${valueTone} ${total ? 'text-base font-bold' : 'font-semibold'}`}>
        {badge ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeTone}`}>{value}</span> : value}
      </dd>
    </div>
  );
}
