import { useState, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type { NearbyProvider } from '@/features/customer-service/api/customerService.api';
import { NearbyProviderCard } from '@/features/customer-service/components/NearbyProviderCard';
import { NearbyProviderAutoAssignOption } from '@/features/customer-service/components/NearbyProviderAutoAssignOption';
import { BookingPickerPopover } from './BookingPickerPopover';
import { BookingProviderDetails } from './BookingProviderDetails';

interface BookingProviderPickerProps {
  anchorRef: RefObject<HTMLDivElement | null>;
  providers: NearbyProvider[];
  preferredProviderId?: string;
  requestedProviderId?: string;
  canSearch: boolean;
  requireSelection: boolean;
  isLoading: boolean;
  loadError: string;
  error?: string;
  onClose: () => void;
  onConfirm: (providerId?: string, providerName?: string) => void;
  zIndex?: number;
  initialProviderId?: string;
  showAutoAssignNote?: boolean;
  allowAutoAssignWhenEmpty?: boolean;
}

export const BookingProviderPicker = ({
  anchorRef, providers, preferredProviderId, requestedProviderId, canSearch, requireSelection,
  isLoading, loadError, error, onClose, onConfirm, zIndex, initialProviderId, showAutoAssignNote, allowAutoAssignWhenEmpty,
}: BookingProviderPickerProps) => {
  const [viewingId, setViewingId] = useState<string | null>(initialProviderId ?? null);
  const canChoose = Boolean(canSearch && !isLoading && !loadError && providers.length > 0);
  const viewingProvider = providers.find((provider) => provider.id === viewingId);

  if (viewingId) {
    return (
      <BookingProviderDetails key={viewingId} providerId={viewingId}
        canSelect={canChoose && Boolean(viewingProvider)}
        onClose={() => setViewingId(null)}
        onSelect={() => {
          if (canChoose && viewingProvider) onConfirm(viewingProvider.id, viewingProvider.user.fullName);
        }}
      />
    );
  }

  return (
    <BookingPickerPopover id="booking-provider-picker" title="Chọn chuyên gia" anchorRef={anchorRef} onClose={onClose} zIndex={zIndex}>
      {!canSearch ? (
        <p className="py-sm text-sm text-on-surface-variant">
          {requireSelection ? 'Chọn ngày và khung giờ để xem thợ còn lịch trống.' : 'Chọn địa chỉ để xem thợ phù hợp.'}
        </p>
      ) : isLoading ? (
        <p role="status" className="flex items-center gap-sm py-sm text-sm text-on-surface-variant">
          <Loader2 size={20} aria-hidden="true" className="animate-spin text-primary" />
          Đang tìm thợ phù hợp…
        </p>
      ) : loadError ? (
        <p role="alert" className="py-sm text-sm text-error">{loadError}</p>
      ) : providers.length === 0 ? (
        <div>
          {allowAutoAssignWhenEmpty && <NearbyProviderAutoAssignOption isSelected={!preferredProviderId} onSelect={() => onConfirm(undefined)} />}
          <p className="py-sm text-sm text-on-surface-variant">
            {requireSelection ? 'Chưa có thợ đang nhận đơn phù hợp với dịch vụ, địa chỉ và lịch đã chọn.' : 'Chưa tìm thấy thợ phù hợp với dịch vụ và địa chỉ đã chọn.'}
          </p>
        </div>
      ) : (
        <div className="space-y-sm">
          {requestedProviderId && !providers.some((item) => item.id === requestedProviderId) && (
            <p className="text-xs text-on-surface-variant">Thợ đã chọn chưa phù hợp với khu vực hoặc lịch này. Vui lòng chọn thợ khác.</p>
          )}
          <NearbyProviderAutoAssignOption isSelected={!preferredProviderId} onSelect={() => onConfirm(undefined)} />
          <div className="max-h-[min(50dvh,360px)] space-y-sm overflow-y-auto overscroll-contain pr-1">
            {providers.map((provider) => (
              <NearbyProviderCard key={provider.id} provider={provider}
                isSelected={provider.id === preferredProviderId} allowSelection requireSelection={requireSelection}
                onViewProfile={(item) => setViewingId(item.id)}
                onSelect={(item) => onConfirm(item.id, item.user.fullName)}
                showAutoAssignNote={showAutoAssignNote}
              />
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-sm text-xs text-error">{error}</p>}
    </BookingPickerPopover>
  );
};
