import { formatCurrency } from '@/utils/currency';
import type { Order } from '../../../types/booking';

const paymentMethodLabel = (method: Order['paymentMethod']) =>
  method === 'wallet' ? 'Ví HandiGo' : method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

export const BookingSuccessPaymentSummary = ({ order }: { order: Order }) => (
  <section className="md:col-span-1 flex flex-col gap-md">
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-md shadow-sm flex flex-col h-full">
      <h3 className="font-headline-md text-headline-md mb-md">Tóm tắt</h3>
      <div className="space-y-sm flex-grow">
        <div className="flex justify-between text-label-md">
          <span className="text-on-surface-variant">
            {order.serviceId.serviceType === 'fixed_price' ? 'Phí dịch vụ' : 'Phí đặt cọc'}
          </span>
          <span className="text-on-surface tabular-nums">{formatCurrency(order.pricing.bookingAmount)}</span>
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
        <div className="flex justify-between text-label-md">
          <span className="text-on-surface-variant">Phương thức</span>
          <span className="text-on-surface">{paymentMethodLabel(order.paymentMethod)}</span>
        </div>
      </div>
      <div className="border-t border-outline-variant/30 pt-sm mt-md">
        <div className="flex justify-between items-center">
          <span className="font-bold text-on-surface">Tổng cộng</span>
          <span className="font-headline-md text-headline-md text-primary tabular-nums">
            {formatCurrency(order.pricing.totalPaidAmount)}
          </span>
        </div>
      </div>
    </div>
  </section>
);
