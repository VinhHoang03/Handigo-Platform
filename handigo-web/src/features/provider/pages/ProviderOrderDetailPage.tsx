import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '@/components/common/DashboardShell';
import { PendingAssignmentCard } from '../components/PendingAssignmentCard';
import { getCustomer } from '../utils/providerOrder.utils';
import { ProviderOrderFeedbackThread } from '../components/ProviderOrderFeedbackThread';
import { OrderTrackingMap } from '@/features/tracking/components/OrderTrackingMap';
import { OrderDetailHeader } from '../components/orders/OrderDetailHeader';
import { CustomerInformationCard } from '../components/orders/CustomerInformationCard';
import { PaymentSummaryCard } from '../components/orders/PaymentSummaryCard';
import { OrderProgressCard } from '../components/orders/OrderProgressCard';
import { QuotationOrderPanel } from '../components/orders/QuotationOrderPanel';
import { FixedPriceActionForm } from '../components/FixedPriceActionForm';
import { CancellationDialog, CancelConfirmationDialog } from '../components/orders/CancelOrderDialogs';
import { ProviderOrderDetailSkeleton } from '../components/orders/ProviderOrderDetailSkeleton';
import { useProviderOrderDetail } from '../hooks/useProviderOrderDetail';
import { getPaymentStatusLabel, orderTypeLabels } from '../utils/providerOrderDetailLabels';

export default function ProviderOrderDetailPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const {
    order,
    assignment,
    quotation,
    loading,
    busy,
    error,
    cancelOpen,
    setCancelOpen,
    cancelConfirmOpen,
    setCancelConfirmOpen,
    cancelReason,
    setCancelReason,
    cancelExplanation,
    setCancelExplanation,
    cancelError,
    setCancelError,
    handleAccept,
    handleReject,
    handleStart,
    handleComplete,
    requestCancelConfirmation,
    handleCancel,
    handleCreateQuotation,
  } = useProviderOrderDetail(orderId, navigate);

  if (loading) {
    return (
      <DashboardShell role="PROVIDER">
        <ProviderOrderDetailSkeleton />
      </DashboardShell>
    );
  }

  if (!order) {
    return (
      <DashboardShell role="PROVIDER">
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined mb-2 text-6xl text-error/60">error_outline</span>
          <h2 className="font-headline-md">{error || 'Không tìm thấy đơn dịch vụ'}</h2>
          <Link to="/provider/orders" className="btn-primary mt-md">
            Quay lại danh sách
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const customer = getCustomer(order);
  const address = order.addressId as {
    fullAddress?: string;
    detailAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
    note?: string;
  };
  const addressLine =
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
  const isUnconfirmedAppointment =
    ['scheduled', 'recurring'].includes(order.orderType) &&
    order.bookingStatus !== 'confirmed';
  const showQuotationForm =
    order.inspectionRequired &&
    !isUnconfirmedAppointment &&
    ['accepted', 'in_progress'].includes(order.status) &&
    !quotation;

  return (
    <DashboardShell role="PROVIDER">
      <div className="space-y-gutter">
        <Link to="/provider/orders" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại danh sách
        </Link>

        {error && (
          <div className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">{error}</div>
        )}

        {assignment && (
          <PendingAssignmentCard
            assignment={assignment}
            onAccept={handleAccept}
            onReject={handleReject}
            busy={busy}
          />
        )}

        <OrderDetailHeader order={order} />

        <div className="grid grid-cols-1 items-start gap-gutter md:grid-cols-2 lg:grid-cols-3">
          <CustomerInformationCard
            order={order}
            customer={customer}
            addressLine={addressLine}
            addressNote={address.note}
            orderType={orderTypeLabels[order.orderType]}
          />
          <PaymentSummaryCard
            order={order}
            paymentStatus={getPaymentStatusLabel(order)}
            quotation={quotation}
          />
          <OrderProgressCard order={order} />
        </div>

        <OrderTrackingMap order={order} viewerRole="PROVIDER" />

        <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-2">
          {order.inspectionRequired ? (
            <QuotationOrderPanel
              order={order}
              quotation={quotation}
              busy={busy}
              isUnconfirmedAppointment={isUnconfirmedAppointment}
              showQuotationForm={showQuotationForm}
              onStart={handleStart}
              onCreateQuotation={handleCreateQuotation}
              onCancel={() => setCancelOpen(true)}
              onComplete={handleComplete}
            />
          ) : (
            <FixedPriceActionForm
              order={order}
              onStart={handleStart}
              onComplete={handleComplete}
              onCancel={() => setCancelOpen(true)}
              busy={busy}
            />
          )}
        </div>

        {order.status === 'completed' && <ProviderOrderFeedbackThread orderId={order._id} />}
      </div>

      {cancelOpen && !cancelConfirmOpen && (
        <CancellationDialog
          reason={cancelReason}
          explanation={cancelExplanation}
          error={cancelError}
          busy={busy}
          onReasonChange={(value) => { setCancelReason(value); setCancelError(''); }}
          onExplanationChange={(value) => { setCancelExplanation(value); setCancelError(''); }}
          onClose={() => { setCancelOpen(false); setCancelError(''); }}
          onConfirm={requestCancelConfirmation}
        />
      )}
      {cancelConfirmOpen && (
        <CancelConfirmationDialog
          reason={cancelReason}
          busy={busy}
          onBack={() => setCancelConfirmOpen(false)}
          onConfirm={() => void handleCancel()}
        />
      )}
    </DashboardShell>
  );
}
