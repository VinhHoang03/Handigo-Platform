import { formatCurrency } from '@/utils/currency';
import type { Order, OrderQuotation } from '../../../types/booking';
import type { BookingResultState } from '../utils/bookingResultState';
import { getAppliedQuotationDeposit, getDirectRepairPayment } from '@/utils/quotationPayment';
import { getOrderStatusMeta } from '@/utils/orderStatus';

const paymentMethodLabel = (method: Order['paymentMethod']) =>
  method === 'wallet' ? 'Ví HandiGo' : method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

export const BookingSuccessPaymentSummary = ({ order, result, quotation, quotationError }: {
  order: Order; result?: BookingResultState; quotation?: OrderQuotation | null; quotationError?: string;
}) => {
  const isInspection = Boolean(order.inspectionRequired || order.serviceId.serviceType === 'variable_price');
  const repairQuotation = isInspection && quotation && ['saved', 'approved'].includes(quotation.quotation.status)
    ? quotation.quotation : null;
  const deposit = getAppliedQuotationDeposit(order);
  const repairCollected = repairQuotation?.directPaymentConfirmedAt && repairQuotation.directPaymentConfirmedAmount != null
    ? repairQuotation.directPaymentConfirmedAmount : null;
  const remaining = repairQuotation ? getDirectRepairPayment(repairQuotation.finalAmount, deposit) : 0;
  const paymentLabel = result === 'order_cancelled'
    ? order.paymentStatus === 'paid' ? 'Đã thanh toán' : order.paymentStatus === 'partially_paid' ? 'Đã thanh toán cọc' : 'Chưa thanh toán'
    : result === 'paid' && isInspection && order.paymentStatus === 'partially_paid' ? 'Đã thanh toán cọc'
      : result ? { paid: 'Đã thanh toán', booked: 'Tiền mặt chưa thu', cancelled: 'Đã hủy giao dịch', failed: 'Chưa thành công', pending: 'Đang chờ', refunded: 'Đã hoàn tiền', error: 'Chưa xác minh' }[result] : '';
  return (
  <section className="md:col-span-1 flex flex-col gap-md">
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm flex flex-col h-full">
      <h3 className="font-headline-md text-lg font-semibold leading-7 mb-3">Tóm tắt</h3>
      <div className="space-y-1.5 flex-grow">
        <div className="flex justify-between gap-3 text-label-md"><span className="text-on-surface-variant">Trạng thái đơn</span><span className="text-right font-semibold">{getOrderStatusMeta(order.status).label}</span></div>
        {result && <div className="flex justify-between gap-3 text-label-md"><span className="text-on-surface-variant">Thanh toán</span><span className="text-right font-semibold">{paymentLabel}</span></div>}
        <div className="flex justify-between text-label-md">
          <span className="text-on-surface-variant">
            {isInspection ? 'Phí cọc ban đầu' : 'Phí dịch vụ'}
          </span>
          <span className="text-on-surface tabular-nums">{formatCurrency(order.pricing.baseAmount ?? order.pricing.bookingAmount)}</span>
        </div>
        {order.pricing.promotionDiscountAmount > 0 && (
          <div className="flex justify-between text-label-md">
            <span className="text-on-surface-variant">Khuyến mãi</span>
            <span className="text-success tabular-nums">-{formatCurrency(order.pricing.promotionDiscountAmount)}</span>
          </div>
        )}
        {order.pricing.voucherDiscountAmount > 0 && (
          <div className="flex justify-between text-label-md">
            <span className="text-on-surface-variant">Voucher</span>
            <span className="text-success tabular-nums">-{formatCurrency(order.pricing.voucherDiscountAmount)}</span>
          </div>
        )}
        {repairQuotation && <>
          <div className="flex justify-between gap-3 text-label-md"><span className="text-on-surface-variant">Cọc đã thanh toán</span><span className="tabular-nums">{formatCurrency(deposit)}</span></div>
          <div className="flex justify-between gap-3 text-label-md"><span className="text-on-surface-variant">Tiền sửa chữa đã thu</span><span className="text-right tabular-nums">{repairCollected !== null ? formatCurrency(repairCollected) : 'Chưa xác nhận'}</span></div>
          {order.status !== 'cancelled' && order.paymentStatus !== 'refunded' && <div className="flex justify-between gap-3 text-label-md"><span className="text-on-surface-variant">Còn cần thanh toán</span><span className="tabular-nums">{formatCurrency(Math.max(remaining - (repairCollected ?? 0), 0))}</span></div>}
        </>}
        {quotationError && <p role="alert" className="text-xs leading-5 text-error">{quotationError}</p>}
        <div className="flex justify-between text-label-md">
          <span className="text-on-surface-variant">Phương thức</span>
          <span className="text-on-surface">{paymentMethodLabel(order.paymentMethod)}</span>
        </div>
      </div>
      <div className="border-t border-outline-variant/30 pt-2 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-on-surface">{repairQuotation ? 'Tổng theo báo giá' : isInspection ? 'Tiền cọc sau giảm' : 'Tổng cộng'}</span>
          <span className="font-headline-md text-xl font-semibold leading-7 text-primary tabular-nums">
            {formatCurrency(repairQuotation?.finalAmount ?? order.pricing.totalPaidAmount)}
          </span>
        </div>
      </div>
    </div>
  </section>
);
};
