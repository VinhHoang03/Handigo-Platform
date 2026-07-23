import {
  BookingStepper,
  OrderCreationShell,
  OrderSummaryCard,
} from '../components/BookingComponents';
import { ConfirmPaymentServiceDetails } from '../components/ConfirmPaymentServiceDetails';
import { ConfirmPaymentMethodSelector } from '../components/ConfirmPaymentMethodSelector';
import { ConfirmPaymentVoucherPanel } from '../components/ConfirmPaymentVoucherPanel';
import { useConfirmPaymentFlow } from '../components/useConfirmPaymentFlow';

const ConfirmPaymentPage = () => {
  const {
    service, address, selectedOptions,
    voucherDiscountAmount, effectivePaymentMethod, isAppointment,
    isSubmitting, paymentError, availableVouchers,
    voucherCode, setVoucherCode, appliedVoucher, setAppliedVoucher, voucherError, setVoucherError,
    applyVoucherCode, handleConfirm,
    setPaymentMethod,
    orderType, scheduledAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities,
  } = useConfirmPaymentFlow();

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={3} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 space-y-gutter">
          <ConfirmPaymentServiceDetails
            isAppointment={isAppointment}
            service={service}
            scheduledAt={scheduledAt}
            address={address}
            preferredProviderId={preferredProviderId}
            preferredProviderName={preferredProviderName}
            selectedOptions={selectedOptions}
            selectedOptionQuantities={selectedOptionQuantities}
          />

          <ConfirmPaymentMethodSelector
            isAppointment={isAppointment}
            service={service}
            effectivePaymentMethod={effectivePaymentMethod}
            onChangeMethod={setPaymentMethod}
            paymentError={paymentError}
          />
        </div>

        <div className="lg:col-span-4">
          <OrderSummaryCard
            step={3}
            discountAmount={voucherDiscountAmount}
            actionLabel={
              orderType === 'scheduled' || orderType === 'recurring'
                ? 'Gửi yêu cầu lịch hẹn'
                : 'Xác nhận & Thanh toán'
            }
            onAction={handleConfirm}
            isLoading={isSubmitting}
            summaryContent={
              <ConfirmPaymentVoucherPanel
                voucherCode={voucherCode}
                onSelectVoucher={(code) => {
                  setVoucherCode(code);
                  applyVoucherCode(code);
                }}
                onManualInputChange={(value) => {
                  setVoucherCode(value);
                  setAppliedVoucher(null);
                  setVoucherError('');
                }}
                onApplyClick={() => applyVoucherCode(voucherCode)}
                availableVouchers={availableVouchers}
                appliedVoucher={appliedVoucher}
                onRemoveVoucher={() => {
                  setVoucherCode('');
                  setAppliedVoucher(null);
                  setVoucherError('');
                }}
                voucherError={voucherError}
                isSubmitting={isSubmitting}
              />
            }
          />
        </div>
      </div>
    </OrderCreationShell>
  );
};

export default ConfirmPaymentPage;
