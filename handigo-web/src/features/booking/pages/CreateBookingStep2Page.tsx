import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { Step2ExecutionInfoSection } from '../components/Step2ExecutionInfoSection';
import { Step2ProviderFieldset } from '../components/Step2ProviderFieldset';
import { Step2ScheduleSection } from '../components/Step2ScheduleSection';
import { useCreateBookingStep2Form } from '../components/useCreateBookingStep2Form';

const CreateBookingStep2Page = () => {
  const {
    serviceId, addressId, preferredProviderId, preferredProviderName, requestedProviderId, orderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    customerAttachments, setPreferredProviderId,
    isUploadingImages, uploadError, formErrors, currentTimestamp,
    upcomingDates, isFromServiceDetail,
    isImmediateBookingAvailable, shouldShowSchedulePicker,
    handleUploadImages, handleRemoveAttachment, handleOrderTypeChange,
    clearFormError, handleSelectAddress, handleContinue, setProviderAvailability,
  } = useCreateBookingStep2Form();

  return (
    <OrderCreationShell>
      <BookingStepper currentStep={2} />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-md">
          <Step2ExecutionInfoSection
            addressId={addressId}
            isFromServiceDetail={isFromServiceDetail}
            addressError={formErrors.addressId}
            onSelectAddress={handleSelectAddress}
            problemDescription={problemDescription || ''}
            problemDescriptionError={formErrors.problemDescription}
            onChangeProblemDescription={(value) => {
              setProblemDescription(value);
              clearFormError('problemDescription');
            }}
            customerAttachments={customerAttachments}
            isUploadingImages={isUploadingImages}
            uploadError={uploadError}
            onUploadImages={(files) => void handleUploadImages(files)}
            onRemoveAttachment={handleRemoveAttachment}
          />

        </div>

        <OrderSummaryCard
          step={2}
          scheduleContent={(
            <Step2ScheduleSection
              orderType={orderType}
              onChangeOrderType={(type) => {
                handleOrderTypeChange(type);
                clearFormError('scheduledAt');
              }}
              scheduledAt={scheduledAt || ''}
              onSelectSlot={(startTime, dateValue) => {
                setScheduledAt(`${dateValue}T${startTime}:00`);
                setPreferredProviderId(undefined);
                clearFormError('scheduledAt');
              }}
              upcomingDates={upcomingDates}
              currentTimestamp={currentTimestamp}
              scheduledAtError={formErrors.scheduledAt}
              isImmediateBookingAvailable={isImmediateBookingAvailable}
            />
          )}
          providerContent={(
            <Step2ProviderFieldset
              serviceId={serviceId}
              addressId={addressId}
              scheduledAt={shouldShowSchedulePicker && scheduledAt?.includes('T') ? scheduledAt : undefined}
              requireSelection={shouldShowSchedulePicker}
              preferredProviderId={preferredProviderId}
              preferredProviderName={preferredProviderName}
              requestedProviderId={requestedProviderId}
              error={formErrors.preferredProviderId}
              onSelectProvider={(providerId, providerName) => {
                setPreferredProviderId(providerId, providerName);
                clearFormError('preferredProviderId');
              }}
              onAvailabilityChange={setProviderAvailability}
            />
          )}
          actionLabel={shouldShowSchedulePicker ? 'Xác nhận' : 'Tiếp tục bước 3'}
          onAction={handleContinue}
        />
      </div>
    </OrderCreationShell>
  );
};

export default CreateBookingStep2Page;
