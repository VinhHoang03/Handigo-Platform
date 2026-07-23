import { Link } from "react-router-dom";
import { BookingShell } from "../components/BookingComponents";
import { OrderFeedbackSection } from "@/features/feedback/components/OrderFeedbackSection";
import { OrderTrackingMap } from "@/features/tracking/components/OrderTrackingMap";
import { AsyncState } from "@/components/common/AsyncState";
import { useBookingDetail } from "../components/detail/useBookingDetail";
import { BookingDetailSkeleton } from "../components/detail/BookingDetailSkeleton";
import { BookingDetailError } from "../components/detail/BookingDetailError";
import { BookingStatusBanners } from "../components/detail/BookingStatusBanners";
import { BookingRecurringSeriesSection } from "../components/detail/BookingRecurringSeriesSection";
import { BookingServiceSummary } from "../components/detail/BookingServiceSummary";
import { BookingQuotationPanel } from "../components/detail/BookingQuotationPanel";
import { BookingProviderCard } from "../components/detail/BookingProviderCard";
import { BookingStatusTimeline } from "../components/detail/BookingStatusTimeline";
import { BookingRefundPanel } from "../components/detail/BookingRefundPanel";
import { BookingComplaintPanel } from "../components/detail/BookingComplaintPanel";
import { BookingPaymentPanel } from "../components/detail/BookingPaymentPanel";
import { BookingReassignmentModal } from "../components/detail/BookingReassignmentModal";
import {
  getPaymentMethodLabel,
  getStatusLabel,
} from "../components/detail/bookingDetailFormatters";
import { formatOrderAddress } from "../components/detail/bookingDetailProvider";

const BookingDetailPage = () => {
  const {
    order,
    recurringOrders,
    quotation,
    loading,
    apiError,
    reassignmentModalOpen,
    busy,
    isWaitingForProvider,
    matchingSecondsRemaining,
    paymentFlow,
    cancellationFlow,
    reassignmentFlow,
    providerInfo,
    hasSuccessfulPayment,
    paymentStatusDisplay,
    appliedDepositAmount,
    remainingQuotationAmount,
    canMakeInitialPayment,
    timeline,
  } = useBookingDetail();

  if (loading) {
    return (
      <BookingShell>
        <AsyncState loading skeleton={<BookingDetailSkeleton />}>
          {null}
        </AsyncState>
      </BookingShell>
    );
  }

  if (apiError || !order) {
    return (
      <BookingShell>
        <BookingDetailError message={apiError} />
      </BookingShell>
    );
  }

  return (
    <BookingShell>
      <div className="flex items-center gap-sm mb-lg">
        <Link
          to="/customer/bookings"
          className="material-symbols-outlined text-primary p-2 hover:bg-primary/10 rounded-full transition-all active:scale-90"
        >
          arrow_back
        </Link>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Chi tiết đơn hàng
          </h1>
          <nav className="flex items-center gap-xs text-label-sm text-on-surface-variant font-label-sm uppercase tracking-wider">
            <Link to="/customer/bookings" className="hover:text-primary">
              Lịch sử
            </Link>
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
            <span className="text-primary font-bold">#{order.orderCode}</span>
          </nav>
        </div>
      </div>

      <BookingStatusBanners
        order={order}
        isWaitingForProvider={isWaitingForProvider}
        matchingSecondsRemaining={matchingSecondsRemaining}
        busy={busy}
        replacementProviderId={reassignmentFlow.replacementProviderId}
        replacementProviderError={reassignmentFlow.replacementProviderError}
        onSelectReplacementProvider={reassignmentFlow.setReplacementProviderId}
        onClearReplacementProviderError={() =>
          reassignmentFlow.setReplacementProviderError(null)
        }
        onSubmitReplacementProvider={() =>
          void reassignmentFlow.handleSelectReplacementProvider()
        }
        onOpenReassignmentModal={reassignmentFlow.openReassignmentModal}
        paymentBannerSlot={
          <BookingPaymentPanel
            order={order}
            busy={busy}
            canMakeInitialPayment={canMakeInitialPayment}
            paymentError={paymentFlow.paymentError}
            paymentMethodModalOpen={paymentFlow.paymentMethodModalOpen}
            initialPaymentMethod={paymentFlow.initialPaymentMethod}
            onChangeMethod={paymentFlow.setInitialPaymentMethod}
            onOpenModal={paymentFlow.openInitialPaymentModal}
            onCloseModal={paymentFlow.closeInitialPaymentModal}
            onSubmitPayment={() => void paymentFlow.handleInitialPayment()}
          />
        }
      />

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-8 flex flex-col gap-lg">
          <OrderTrackingMap order={order} viewerRole="CUSTOMER" compact />

          <BookingRecurringSeriesSection
            order={order}
            recurringOrders={recurringOrders}
          />

          <BookingServiceSummary
            order={order}
            statusLabel={getStatusLabel(order.status)}
            paymentMethodLabel={getPaymentMethodLabel(order.paymentMethod)}
            paymentStatusDisplay={paymentStatusDisplay!}
            address={formatOrderAddress(order)}
          >
            <BookingQuotationPanel
              order={order}
              quotation={quotation}
              busy={busy}
              appliedDepositAmount={appliedDepositAmount}
              remainingQuotationAmount={remainingQuotationAmount}
              onConfirm={cancellationFlow.handleConfirmQuotation}
              onReject={cancellationFlow.handleRejectQuotation}
            />
          </BookingServiceSummary>

          {order.status === "completed" && (
            <OrderFeedbackSection orderId={order._id} />
          )}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-lg">
          <BookingProviderCard
            providerInfo={providerInfo}
            orderId={order._id}
            orderStatus={order.status}
            hasSuccessfulPayment={hasSuccessfulPayment}
          />

          <BookingStatusTimeline
            status={order.status}
            statusLabel={getStatusLabel(order.status)}
            timeline={timeline}
          />

          <BookingRefundPanel
            order={order}
            busy={busy}
            pendingAction={cancellationFlow.pendingAction}
            cancellationPreview={cancellationFlow.cancellationPreview}
            onCancelOrder={() => void cancellationFlow.handleCancelOrder()}
            onCancelSeries={() => void cancellationFlow.handleCancelSeries()}
            onCloseDialog={cancellationFlow.closeActionDialog}
            onUpdateReason={cancellationFlow.updateActionReason}
            onUpdateAdditionalInfo={cancellationFlow.updateAdditionalInfo}
            onExecute={() => void cancellationFlow.executePendingAction()}
          />

          <BookingComplaintPanel orderId={order._id} />
        </aside>
      </main>

      <BookingReassignmentModal
        order={order}
        open={reassignmentModalOpen}
        busy={busy}
        reassignmentError={reassignmentFlow.reassignmentError}
        onClose={reassignmentFlow.closeReassignmentModal}
        onRespond={(decision) =>
          void reassignmentFlow.handleReassignmentResponse(decision)
        }
      />
    </BookingShell>
  );
};

export default BookingDetailPage;
