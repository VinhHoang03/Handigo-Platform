import type { Order } from '@/types/booking';
import { getAppliedQuotationDeposit, getDirectRepairPayment, isQuotationPaidByWallet } from '@/utils/quotationPayment';
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
  const isQuotationWalletPaid = isQuotationPaidByWallet(order, repairQuotation);
  const quotationPaymentMethod = repairQuotation?.directPaymentConfirmedAt ? 'Thanh toán trực tiếp'
    : isQuotationWalletPaid ? 'Ví Handigo' : null;

  return (
    <section className="order-3 h-full rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:p-lg md:col-span-2 lg:order-2 lg:col-span-1">
      <CardTitle icon={Wallet} title="Thanh toán đơn hàng" />
      <dl className="mt-md space-y-3 text-sm">
        {displayedPaymentStatus && <FinancialRow label={isQuotationOrder && !isQuotationWalletPaid && !repairQuotation?.directPaymentConfirmedAt ? 'Trạng thái tiền cọc' : 'Trạng thái thanh toán'} value={displayedPaymentStatus} />}
        {isQuotationOrder && (
          <>
            <FinancialRow label="Tiền cọc đã thanh toán" value={formatMoney(appliedDepositAmount)} />
            <FinancialRow label="Giá trị đơn hàng" value={quotationAmount === undefined ? '' : formatMoney(quotationAmount)} total />
            {quotationAmount !== undefined && !isCancelled && (
              <>
                <FinancialRow
                  label={repairQuotation?.directPaymentConfirmedAt ? 'Đã thu trực tiếp từ khách'
                    : isQuotationWalletPaid ? 'Đã thanh toán qua ví' : 'Còn cần thanh toán'}
                  value={formatMoney(directRepairAmount)}
                  total
                />
              </>
            )}
          </>
        )}
        {!isQuotationOrder && (
          <>
            <FinancialRow label="Giá trị dịch vụ" value={formatMoney(order.pricing.bookingAmount)} />
            {discount > 0 && <FinancialRow label="Giảm giá" value={`-${formatMoney(discount)}`} />}
            <FinancialRow label="Tổng tiền khách phải trả" value={formatMoney(order.pricing.totalPaidAmount)} total />
          </>
        )}
        {isQuotationOrder ? quotationPaymentMethod && (
          <FinancialRow label="Phương thức thanh toán" value={quotationPaymentMethod} />
        ) : (
          <FinancialRow label="Phương thức" value={paymentMethod} />
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
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
      <dt className={total ? 'font-bold text-on-surface' : 'text-on-surface-variant'}>{label}</dt>
      <dd className={`min-w-0 break-words text-right tabular-nums text-on-surface ${total ? 'text-base font-bold' : 'font-semibold'}`}>{value}</dd>
    </div>
  );
}
