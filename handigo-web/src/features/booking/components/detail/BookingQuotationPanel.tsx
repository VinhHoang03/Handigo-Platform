import type { Order, OrderQuotation } from "@/types/booking";
import { isQuotationPaidByWallet } from "@/utils/quotationPayment";
import { BookingQuotationDetails } from "./BookingQuotationDetails";
import { BookingQuotationPending } from "./BookingQuotationPending";
import { BookingQuotationWalletPayment } from "./BookingQuotationWalletPayment";
import type { useBookingQuotationPayment } from "./useBookingQuotationPayment";

type BookingQuotationPanelProps = {
  order: Order;
  quotation: OrderQuotation | null;
  busy: boolean;
  appliedDepositAmount: number;
  remainingQuotationAmount: number;
  onReject: () => void;
  paymentFlow: ReturnType<typeof useBookingQuotationPayment>;
};

/**
 * Khối báo giá sửa chữa: chỉ hiển thị khi dịch vụ không phải giá cố định,
 * cần khảo sát, hoặc đã có báo giá bổ sung. Khối chờ báo giá chỉ hiện sau khi thợ nhận đơn.
 */
export const BookingQuotationPanel = ({
  order,
  quotation,
  busy,
  appliedDepositAmount,
  remainingQuotationAmount,
  onReject,
  paymentFlow,
}: BookingQuotationPanelProps) => {
  const shouldShow =
    order.serviceId?.serviceType !== "fixed_price" ||
    order.inspectionRequired ||
    order.hasAdditionalQuotation;

  if (!shouldShow || (!quotation && !["accepted", "in_progress"].includes(order.status))) return null;

  return (
    <div className="mt-lg pt-lg border-t-4 border-primary/20 w-full overflow-hidden text-sm leading-6">
      {quotation ? (
        <BookingQuotationDetails
          quotation={quotation}
          orderStatus={order.status}
          paidByWallet={isQuotationPaidByWallet(order, quotation.quotation)}
          busy={busy}
          appliedDepositAmount={appliedDepositAmount}
          remainingQuotationAmount={remainingQuotationAmount}
          onReject={onReject}
        />
      ) : (
        <BookingQuotationPending orderStatus={order.status} />
      )}
      <BookingQuotationWalletPayment flow={paymentFlow} busy={busy} />
    </div>
  );
};
