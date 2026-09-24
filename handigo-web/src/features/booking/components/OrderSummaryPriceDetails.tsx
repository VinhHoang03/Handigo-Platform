import type { ReactNode } from 'react';
import type { Service, ServiceOption } from '../../../types/booking';

const getOptionPrice = (option: ServiceOption) => option.price ?? option.fixedPrice ?? 0;

interface OrderSummaryPriceDetailsProps {
  service: Service | null;
  selectedOptions: ServiceOption[];
  selectedOptionQuantities?: Record<string, number>;
  total: number;
  finalTotal: number;
  discountAmount: number;
  summaryContent?: ReactNode;
}

/** Khối liệt kê phí cọc/tuỳ chọn đã chọn và tổng tiền cuối cùng. */
export const OrderSummaryPriceDetails: React.FC<OrderSummaryPriceDetailsProps> = ({
  service,
  selectedOptions,
  selectedOptionQuantities,
  total,
  finalTotal,
  discountAmount,
  summaryContent,
}) => (
  <>
    <div className="border-t border-dashed border-outline-variant pt-md space-y-sm text-sm">
      {service?.serviceType === 'variable_price' && (
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Phí đặt cọc</span>
          <span className="font-medium">{(service?.depositAmount || 0).toLocaleString()}đ</span>
        </div>
      )}
      {selectedOptions.map(opt => (
        <div key={opt._id} className="flex justify-between">
          <span className="text-on-surface-variant">
            {opt.name}
            {(selectedOptionQuantities?.[opt._id] ?? 1) > 1
              ? ` × ${selectedOptionQuantities?.[opt._id]}`
              : ''}
          </span>
          {service?.serviceType !== 'variable_price' && (
            <span className="font-medium">
              {(getOptionPrice(opt) * (selectedOptionQuantities?.[opt._id] ?? 1)).toLocaleString()}đ
            </span>
          )}
        </div>
      ))}
    </div>

    <div className="pt-md border-t border-outline-variant flex justify-between items-center">
      <div>
        <span className="font-bold">Tổng cộng</span>
        {discountAmount > 0 && (
          <p className="mt-1 text-sm font-semibold text-success">
            Đã giảm {discountAmount.toLocaleString("vi-VN")}đ
          </p>
        )}
      </div>
      <div className="text-right">
        {discountAmount > 0 && (
          <p className="text-sm text-on-surface-variant line-through">
            {total.toLocaleString("vi-VN")}đ
          </p>
        )}
        <span className="text-2xl font-bold text-primary">
          {finalTotal.toLocaleString("vi-VN")}đ
        </span>
      </div>
    </div>

    {summaryContent}
  </>
);
