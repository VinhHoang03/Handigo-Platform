import type { Order, OrderQuotation } from "@/types/booking";
import { BookingQuotationDetails } from "./BookingQuotationDetails";
import { BookingQuotationPending } from "./BookingQuotationPending";

type BookingQuotationPanelProps = {
  order: Order;
  quotation: OrderQuotation | null;
  busy: boolean;
  paidDepositAmount: number;
  onConfirm: () => void;
  onReject: () => void;
};

/**
 * Khối báo giá sửa chữa: chỉ hiển thị khi dịch vụ không phải giá cố định,
 * cần khảo sát, hoặc đã có báo giá bổ sung — giữ nguyên điều kiện gốc.
 */
export const BookingQuotationPanel = ({
  order,
  quotation,
  busy,
  paidDepositAmount,
  onConfirm,
  onReject,
}: BookingQuotationPanelProps) => {
  const shouldShow =
    order.serviceId?.serviceType !== "fixed_price" ||
    order.inspectionRequired ||
    order.hasAdditionalQuotation;

  if (!shouldShow) return null;

  return (
    <div className="mt-lg pt-lg border-t-4 border-primary/20 w-full overflow-hidden">
      {quotation ? (
        <BookingQuotationDetails
          order={order}
          quotation={quotation}
          busy={busy}
          paidDepositAmount={paidDepositAmount}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      ) : (
        <BookingQuotationPending orderStatus={order.status} />
      )}
    </div>
  );
};
