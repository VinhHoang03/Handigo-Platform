import { useRef, useState } from 'react';
import { ChevronDown, UserRound } from 'lucide-react';
import { useNearbyProviders, type ProviderAvailabilityStatus } from '@/features/customer-service/components/useNearbyProviders';
import { BookingProviderPicker } from './BookingProviderPicker';
import { useBookingStore } from '../hooks/useBookingStore';

interface Step2ProviderFieldsetProps {
  serviceId?: string;
  addressId?: string;
  scheduledAt?: string;
  recurrenceUnit?: 'weekly' | 'monthly';
  recurrenceCount?: number;
  requireSelection?: boolean;
  preferredProviderId?: string;
  preferredProviderName?: string;
  requestedProviderId?: string;
  error?: string;
  onSelectProvider: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange: (status: ProviderAvailabilityStatus) => void;
}

/** Kiểm tra thợ phù hợp và mở danh sách chuyên gia từ tóm tắt đơn hàng. */
export const Step2ProviderFieldset = ({
  serviceId, addressId, scheduledAt, recurrenceUnit, recurrenceCount,
  requireSelection = false, preferredProviderId, preferredProviderName, requestedProviderId, error,
  onSelectProvider, onAvailabilityChange,
}: Step2ProviderFieldsetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rebookSource = useBookingStore(state => state.rebookSource);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { providers, isLoading, error: loadError } = useNearbyProviders({
    serviceId, addressId, scheduledAt, recurrenceUnit, recurrenceCount, requireSelection,
    enabled: true, allowSelection: true, selectedProviderId: preferredProviderId,
    requestedProviderId, onSelectProvider, onAvailabilityChange,
  });
  const canSearch = Boolean(serviceId && addressId && (!requireSelection || scheduledAt));

  return (
    <section className="border-t border-dashed border-outline-variant pt-md">
      <div ref={anchorRef}>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-haspopup="dialog"
        aria-controls={isExpanded ? 'booking-provider-picker' : undefined}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="flex min-h-12 w-full items-center gap-sm rounded-xl px-sm py-xs text-left hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
      >
        <UserRound aria-hidden="true" size={19} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-on-surface-variant">Phân phối chuyên gia</span>
          <span className="block truncate text-sm font-bold text-on-surface">
            {preferredProviderName || 'Handigo tự điều phối thợ'}
          </span>
        </span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      </div>
      {error && !isExpanded && <p role="alert" className="mt-xs text-xs text-error">{error}</p>}
      {rebookSource && requestedProviderId && canSearch && !isLoading && !loadError && !providers.some(provider => provider.id === requestedProviderId) && (
        <p role="status" className="mt-xs text-xs text-error">Thợ cũ chưa khả dụng với địa chỉ và lịch này. Vui lòng mở danh sách để chọn thợ khác hoặc Handigo tự điều phối.</p>
      )}
      {isExpanded && (
        <BookingProviderPicker
          anchorRef={anchorRef} providers={providers} preferredProviderId={preferredProviderId}
          requestedProviderId={requestedProviderId} canSearch={canSearch} requireSelection={requireSelection}
          isLoading={isLoading} loadError={loadError} error={error}
          onClose={() => setIsExpanded(false)}
          onConfirm={(providerId, providerName) => {
            const booking = useBookingStore.getState();
            if (booking.rebookSource) booking.setRequestedProvider(undefined);
            onSelectProvider(providerId, providerName);
            setIsExpanded(false);
          }}
        />
      )}
    </section>
  );
};
