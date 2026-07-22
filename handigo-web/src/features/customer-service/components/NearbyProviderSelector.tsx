import type { NearbyProvider } from "../api/customerService.api";
import { NearbyProviderAutoAssignOption } from "./NearbyProviderAutoAssignOption";
import { NearbyProviderCard } from "./NearbyProviderCard";
import { useNearbyProviders, type ProviderAvailabilityStatus } from "./useNearbyProviders";

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
        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Các chuyên gia phụ trách
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
            ? "Chọn ngày và khung giờ để xem chuyên gia còn lịch trống."
            : "Chọn dịch vụ và địa chỉ để tìm chuyên gia phù hợp."}
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary">
            progress_activity
          </span>
          Đang tìm chuyên gia gần bạn...
        </div>
      ) : error ? (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          {requireSelection
            ? "Chưa có chuyên gia còn trống trong khung giờ này. Vui lòng chọn giờ khác."
            : "Chưa có chuyên gia phù hợp với địa chỉ đã chọn."}
        </p>
      ) : (
        <div className="space-y-3">
          {requestedProviderId &&
            !providers.some((provider) => provider.id === requestedProviderId) && (
              <p className="rounded-lg bg-tertiary-fixed/45 px-3 py-2 text-sm font-semibold text-on-tertiary-fixed-variant">
                Chuyên gia đã chọn chưa phù hợp với khu vực hoặc lịch này. Vui lòng đổi lịch hoặc chọn chuyên gia khác.
              </p>
            )}
          {allowSelection && !requireSelection && (
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
