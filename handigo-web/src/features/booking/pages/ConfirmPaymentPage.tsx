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
    scheduledAt, preferredProviderId, preferredProviderName,
    selectedOptionQuantities, uniformQuantity,
    previewVoucherCode, promotionName, previewError,
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
            uniformQuantity={uniformQuantity}
          />

          <ConfirmPaymentMethodSelector
            service={service}
            effectivePaymentMethod={effectivePaymentMethod}
            onChangeMethod={setPaymentMethod}
            paymentError={paymentError}
          />
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <OrderSummaryCard
            step={3}
            discountAmount={voucherDiscountAmount}
            voucherCode={previewVoucherCode}
            actionLabel="Xác nhận & Thanh toán"
            onAction={handleConfirm}
            isLoading={isSubmitting}
            summaryContent={
              <>
              {promotionName && <p className="mb-3 rounded-xl bg-primary/10 p-3 text-primary">Ưu đãi tự động: {promotionName}</p>}
              {previewError && <p role="alert" className="mb-3 text-error">{previewError}</p>}
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
              </>
            }
          />
        </div>
      </div>
    </OrderCreationShell>
  );
};

export default ConfirmPaymentPage;
