import { NearbyProviderSelector } from '@/features/customer-service/components/NearbyProviderSelector';
import type { ProviderAvailabilityStatus } from '@/features/customer-service/components/NearbyProviderSelector';

interface Step2ProviderFieldsetProps {
  /** Khi có giá trị: hiển thị dạng fieldset đánh số (luồng hẹn lịch). Bỏ trống: hiển thị trần (luồng đặt ngay). */
  stepNumber?: number;
  serviceId?: string;
  addressId?: string;
  scheduledAt?: string;
  recurrenceUnit?: 'weekly' | 'monthly';
  recurrenceCount?: number;
  requireSelection?: boolean;
  preferredProviderId?: string;
  requestedProviderId?: string;
  error?: string;
  onSelectProvider: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange: (status: ProviderAvailabilityStatus) => void;
}

/** "Chọn chuyên gia": bọc NearbyProviderSelector, có/không đánh số bước tùy luồng đặt lịch. */
export const Step2ProviderFieldset = ({
  stepNumber, serviceId, addressId, scheduledAt, recurrenceUnit, recurrenceCount,
  requireSelection, preferredProviderId, requestedProviderId, error,
  onSelectProvider, onAvailabilityChange,
}: Step2ProviderFieldsetProps) => {
  const selector = (
    <>
      <NearbyProviderSelector
        serviceId={serviceId}
        addressId={addressId}
        scheduledAt={scheduledAt}
        recurrenceUnit={recurrenceUnit}
        recurrenceCount={recurrenceCount}
        requireSelection={requireSelection}
        selectedProviderId={preferredProviderId}
        requestedProviderId={requestedProviderId}
        onSelectProvider={onSelectProvider}
        onAvailabilityChange={onAvailabilityChange}
      />
      {error && (
        <p role="alert" className="mt-xs text-xs font-medium text-error">
          {error}
        </p>
      )}
    </>
  );

  if (stepNumber === undefined) {
    return <div className="mt-md">{selector}</div>;
  }

  return (
    <fieldset>
      <legend className="mb-sm flex items-center gap-sm text-sm font-bold text-on-surface">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-on-primary">{stepNumber}</span>
        Chọn chuyên gia
      </legend>
      {selector}
    </fieldset>
  );
};
