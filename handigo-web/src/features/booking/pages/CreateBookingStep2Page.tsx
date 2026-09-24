import { BookingStepper, OrderCreationShell, OrderSummaryCard } from '../components/BookingComponents';
import { Step2ExecutionInfoSection } from '../components/Step2ExecutionInfoSection';
import { Step2ScheduleSection } from '../components/Step2ScheduleSection';
import { useCreateBookingStep2Form } from '../components/useCreateBookingStep2Form';

const CreateBookingStep2Page = () => {
  const {
    serviceId, addressId, preferredProviderId, requestedProviderId, orderType,
    scheduledAt, setScheduledAt, problemDescription, setProblemDescription,
    recurrenceUnit, setRecurrenceUnit, recurrenceCount, setRecurrenceCount,
    customerAttachments, setPreferredProviderId,
    isUploadingImages, uploadError, formErrors, currentTimestamp,
    todayInputValue, upcomingDates, recurringPreview, recurrenceCountOptions,
    isFromServiceDetail, shouldShowSchedulePicker,
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

          <Step2ScheduleSection
            orderType={orderType}
            onChangeOrderType={(type) => {
              handleOrderTypeChange(type);
              clearFormError('scheduledAt');
            }}
            scheduledAt={scheduledAt || ''}
            onSelectDate={(dateValue) => {
              setScheduledAt(dateValue);
              setPreferredProviderId(undefined);
              clearFormError('scheduledAt');
            }}
            onSelectSlot={(startTime) => {
              if (!scheduledAt) return;
              const date = scheduledAt.split('T')[0];
              setScheduledAt(`${date}T${startTime}:00`);
              setPreferredProviderId(undefined);
              clearFormError('scheduledAt');
            }}
            todayInputValue={todayInputValue}
            upcomingDates={upcomingDates}
            currentTimestamp={currentTimestamp}
            scheduledAtError={formErrors.scheduledAt}
            recurrenceUnit={recurrenceUnit}
            onChangeRecurrenceUnit={(unit) => {
              setRecurrenceUnit(unit);
              setRecurrenceCount(unit === 'weekly' ? 1 : 4);
              setPreferredProviderId(undefined);
            }}
            recurrenceCount={recurrenceCount}
            onChangeRecurrenceCount={(count) => {
              setRecurrenceCount(count);
              setPreferredProviderId(undefined);
            }}
            recurrenceCountOptions={recurrenceCountOptions}
            recurringPreviewDates={recurringPreview}
            serviceId={serviceId}
            addressId={addressId}
            preferredProviderId={preferredProviderId}
            requestedProviderId={requestedProviderId}
            preferredProviderError={formErrors.preferredProviderId}
            onSelectProvider={(providerId, providerName) => {
              setPreferredProviderId(providerId, providerName);
              clearFormError('preferredProviderId');
            }}
            onAvailabilityChange={setProviderAvailability}
          />
        </div>

        <OrderSummaryCard
          step={2}
          actionLabel={shouldShowSchedulePicker ? 'Xác nhận' : 'Tiếp tục bước 3'}
          onAction={handleContinue}
        />
      </div>
    </OrderCreationShell>
  );
};

export default CreateBookingStep2Page;
