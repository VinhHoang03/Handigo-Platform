import type { NearbyProvider } from "../api/customerService.api";
import { NearbyProviderAutoAssignOption } from "./NearbyProviderAutoAssignOption";
import { NearbyProviderCard } from "./NearbyProviderCard";
import { useNearbyProviders, type ProviderAvailabilityStatus } from "./useNearbyProviders";
import { Loader2 } from "lucide-react";

// Re-export để giữ nguyên đường dẫn import cũ (`.../NearbyProviderSelector`).
export type { ProviderAvailabilityStatus };

interface NearbyProviderSelectorProps {
  serviceId?: string;
  addressId?: string;
  enabled?: boolean;
  scheduledAt?: string;
  requireSelection?: boolean;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: number;
  orderId?: string;
  allowSelection?: boolean;
  selectedProviderId?: string;
  requestedProviderId?: string;
  onSelectProvider?: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange?: (status: ProviderAvailabilityStatus) => void;
}

export function NearbyProviderSelector({
  serviceId,
  addressId,
  enabled = true,
  scheduledAt,
  requireSelection = false,
  recurrenceUnit,
  recurrenceCount,
  orderId,
  allowSelection = true,
  selectedProviderId,
  requestedProviderId,
  onSelectProvider,
  onAvailabilityChange,
}: NearbyProviderSelectorProps) {
  const { providers, isLoading, error } = useNearbyProviders({
    serviceId,
    addressId,
    enabled,
    scheduledAt,
    requireSelection,
    recurrenceUnit,
    recurrenceCount,
    orderId,
    allowSelection,
    selectedProviderId,
    requestedProviderId,
    onSelectProvider,
    onAvailabilityChange,
  });

  const selectProvider = (provider: NearbyProvider) => {
    if (!allowSelection || !onSelectProvider) return;
    const isSelected = selectedProviderId === provider.id;
    onSelectProvider(
      isSelected ? undefined : provider.id,
      isSelected ? undefined : provider.user.fullName,
    );
  };

  const canSearch = enabled && serviceId && addressId && (!requireSelection || scheduledAt);

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-label-md font-semibold text-on-surface">
          Thợ nhận việc này
        </h3>
        {providers.length > 0 && (
          <span className="rounded-full bg-primary-container/10 px-2 py-1 text-xs font-bold text-primary">
            {providers.length} phù hợp
          </span>
        )}
      </div>

      {!canSearch ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          {requireSelection
            ? "Chọn ngày và khung giờ để xem thợ còn lịch trống."
            : "Chọn địa chỉ để xem thợ nào nhận được việc này."}
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
          <Loader2 aria-hidden="true" size={24} className="animate-spin text-primary" />
          Đang tìm thợ gần bạn...
        </div>
      ) : error ? (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          {requireSelection
            ? "Chưa có thợ nào trống trong khung giờ này. Thử chọn giờ khác."
            : "Chưa có thợ nào nhận việc ở địa chỉ này."}
        </p>
      ) : (
        <div className="space-y-3">
          {requestedProviderId &&
            !providers.some((provider) => provider.id === requestedProviderId) && (
              <p className="rounded-lg bg-tertiary-fixed/45 px-3 py-2 text-sm font-semibold text-on-tertiary-fixed-variant">
                Thợ đã chọn chưa phù hợp với khu vực hoặc lịch này. Đổi lịch hoặc chọn thợ khác.
              </p>
            )}
          {/* Kể cả luồng bắt buộc chọn cũng được phép để Handigo tự điều phối. */}
          {allowSelection && (
            <NearbyProviderAutoAssignOption
              isSelected={!selectedProviderId}
              onSelect={() => onSelectProvider?.(undefined)}
            />
          )}

          {providers.map((provider) => (
            <NearbyProviderCard
              key={provider.id}
              provider={provider}
              isSelected={allowSelection && selectedProviderId === provider.id}
              allowSelection={allowSelection}
              requireSelection={requireSelection}
              onSelect={selectProvider}
            />
          ))}
        </div>
      )}
    </section>
  );
}
