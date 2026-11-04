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
import { ArrowLeft, CircleAlert } from "lucide-react";
import { OrderArrivalPanel } from '../components/orders/OrderArrivalPanel';
import { OrderReschedulePanel } from '@/features/booking/components/detail/OrderReschedulePanel';

export default function ProviderOrderDetailPage() {
  const { orderId } = useParams();
  return <ProviderOrderDetailContent key={orderId} orderId={orderId} />;
}

function ProviderOrderDetailContent({ orderId }: { orderId: string | undefined }) {
  const navigate = useNavigate();
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
    handleArrival,
    checkNoShow,
    handleNoShow,
    handleComplete,
    handleConfirmQuotationPayment,
    handleConfirmCashPayment,
    requestCancelConfirmation,
    handleCancel,
    handleCreateQuotation,
    reload,
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
          <CircleAlert aria-hidden="true" size={60} className="mb-2 text-error/60" />
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
  const isQuotationOrder =
    order.inspectionRequired || order.serviceId.serviceType === 'variable_price';
  const showQuotationForm =
    isQuotationOrder &&
    !isUnconfirmedAppointment &&
    ['accepted', 'in_progress'].includes(order.status) &&
    !quotation;

  return (
    <DashboardShell role="PROVIDER">
      <div className="space-y-gutter">
        <Link to="/provider/orders" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft aria-hidden="true" size={16} />
          Quay lại danh sách
        </Link>

        {error && (
          <div role="alert" className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">
            {error}
            <button type="button" disabled={busy} onClick={() => void reload()} className="ml-3 font-semibold underline">Tải lại dữ liệu</button>
          </div>
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

        <OrderReschedulePanel
          order={order}
          viewerRole="PROVIDER"
          onChanged={() => reload(false)}
        />

        <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <CustomerInformationCard
              order={order}
              customer={customer}
              addressLine={addressLine}
              orderType={orderTypeLabels[order.orderType]}
            />
          </div>
          <div className="min-w-0 space-y-gutter lg:col-span-5">
            <PaymentSummaryCard
              order={order}
              paymentStatus={getPaymentStatusLabel(order)}
              quotation={quotation}
            />
            <OrderProgressCard order={order} />
          </div>
        </div>

        <OrderTrackingMap order={order} viewerRole="PROVIDER" />
        {!quotation && !order.currentQuotationId && <OrderArrivalPanel order={order} busy={busy} onArrival={handleArrival}
          onCancel={() => setCancelOpen(true)} checkNoShow={checkNoShow} onNoShow={handleNoShow} />}

        <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-2">
          {isQuotationOrder ? (
            <QuotationOrderPanel
              key={order._id}
              order={order}
              quotation={quotation}
              busy={busy}
              isUnconfirmedAppointment={isUnconfirmedAppointment}
              showQuotationForm={showQuotationForm}
              onStart={handleStart}
              onCreateQuotation={handleCreateQuotation}
              onCancel={() => setCancelOpen(true)}
              onComplete={handleComplete}
              onConfirmPayment={handleConfirmQuotationPayment}
            />
          ) : (order.status !== 'accepted' || (!!order.arrival && order.arrival.providerId === order.providerId?._id)) ? (
            <div className="lg:col-span-2">
            <FixedPriceActionForm
              order={order}
              onConfirmCashPayment={handleConfirmCashPayment}
              onStart={handleStart}
              onComplete={handleComplete}
              onCancel={() => setCancelOpen(true)}
              busy={busy}
            />
            </div>
          ) : null}
        </div>

        {order.status === 'completed' && <ProviderOrderFeedbackThread orderId={order._id} />}
      </div>

      {cancelOpen && !cancelConfirmOpen && !quotation && !order.currentQuotationId && order.status === 'accepted' && (
        <CancellationDialog
          order={order}
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
      {cancelConfirmOpen && !quotation && !order.currentQuotationId && order.status === 'accepted' && (
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
