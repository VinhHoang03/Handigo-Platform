import { useEffect, useState } from "react";
import {
  customerServiceApi,
  type NearbyProvider,
} from "../api/customerService.api";

export type ProviderAvailabilityStatus =
  | "idle"
  | "loading"
  | "available"
  | "unavailable"
  | "error";

interface UseNearbyProvidersArgs {
  serviceId?: string;
  addressId?: string;
  enabled: boolean;
  scheduledAt?: string;
  requireSelection: boolean;
  recurrenceUnit?: "weekly" | "monthly";
  recurrenceCount?: number;
  orderId?: string;
  allowSelection: boolean;
  selectedProviderId?: string;
  requestedProviderId?: string;
  onSelectProvider?: (providerId?: string, providerName?: string) => void;
  onAvailabilityChange?: (status: ProviderAvailabilityStatus) => void;
}

/** Tải danh sách thợ gần địa chỉ đã chọn và đồng bộ lựa chọn hiện tại. */
export function useNearbyProviders({
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
}: UseNearbyProvidersArgs) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!enabled || !serviceId || !addressId || (requireSelection && !scheduledAt)) {
      onAvailabilityChange?.("idle");
      return () => {
        isMounted = false;
      };
    }

    const loadProviders = async () => {
      setIsLoading(true);
      setHasLoaded(false);
      setError("");
      onAvailabilityChange?.("loading");

      try {
        const data = await customerServiceApi.nearbyProviders(
          serviceId,
          addressId,
          scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          recurrenceUnit,
          recurrenceCount,
          orderId,
        );
        if (isMounted) {
          setProviders(data);
          onAvailabilityChange?.(data.length > 0 ? "available" : "unavailable");
        }
      } catch {
        if (!isMounted) return;
        setProviders([]);
        setError("Không tải được danh sách thợ ở địa chỉ này.");
        onAvailabilityChange?.("error");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    };

    void loadProviders();

    return () => {
      isMounted = false;
    };
  }, [addressId, enabled, onAvailabilityChange, orderId, recurrenceCount, recurrenceUnit, requireSelection, scheduledAt, serviceId]);

  useEffect(() => {
    if (!allowSelection || !hasLoaded || !onSelectProvider || !selectedProviderId) return;
    if (providers.some((provider) => provider.id === selectedProviderId)) return;
    onSelectProvider(undefined);
  }, [allowSelection, hasLoaded, onSelectProvider, providers, selectedProviderId]);

  useEffect(() => {
    if (
      !allowSelection ||
      !hasLoaded ||
      !onSelectProvider ||
      !requestedProviderId ||
      selectedProviderId
    ) {
      return;
    }
    const requestedProvider = providers.find(
      (provider) => provider.id === requestedProviderId,
    );
    if (requestedProvider) {
      onSelectProvider(
        requestedProvider.id,
        requestedProvider.user.fullName,
      );
    }
  }, [
    allowSelection,
    hasLoaded,
    onSelectProvider,
    providers,
    requestedProviderId,
    selectedProviderId,
  ]);

  return { providers, isLoading, error };
}
