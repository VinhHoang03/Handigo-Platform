import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useState } from "react";
import { useBookingStore } from '@/features/booking/hooks/useBookingStore';
import { getDefaultScheduledAt, getEarliestScheduledAt } from '@/features/booking/components/step2Helpers';
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
  const booking = useBookingStore();
  const selectedOptions = !orderId && booking.serviceId === serviceId && booking.selectedOptionIds.length
    ? JSON.stringify(booking.selectedOptionIds.map((optionId) => ({ optionId, quantity: booking.selectedOptionQuantities?.[optionId] ?? 1 }))) : undefined;
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useToastFeedback<string>("", "error");

  useEffect(() => {
    let isMounted = true;

    if (!enabled || !serviceId || !addressId || (requireSelection && !scheduledAt)) {
      onAvailabilityChange?.("idle");
      return () => {
        isMounted = false;
      };
    }

    const isExpiredSchedule = () => scheduledAt
      ? new Date(scheduledAt).getTime() < getEarliestScheduledAt().getTime()
      : false;
    const refreshExpiredDefault = () => {
      const currentBooking = useBookingStore.getState();
      if (orderId || currentBooking.serviceId !== serviceId || !currentBooking.isScheduleAutomatic
        || currentBooking.scheduledAt !== scheduledAt || !isExpiredSchedule()) return false;
      currentBooking.setScheduledAt(getDefaultScheduledAt(), true);
      return true;
    };
    const expiredScheduleMessage = 'Thời gian đã chọn đã qua. Vui lòng chọn lại ngày hoặc giờ thực hiện.';
    const loadProviders = async () => {
      if (refreshExpiredDefault()) {
        onAvailabilityChange?.('loading');
        return;
      }
      if (isExpiredSchedule()) {
        setProviders([]);
        setIsLoading(false);
        setHasLoaded(false);
        setError(expiredScheduleMessage);
        onAvailabilityChange?.('error');
        return;
      }
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
          selectedOptions,
        );
        if (isMounted) {
          setProviders(data);
          onAvailabilityChange?.(data.length > 0 ? "available" : "unavailable");
        }
      } catch {
        if (!isMounted) return;
        if (refreshExpiredDefault()) return;
        setProviders([]);
        setError(isExpiredSchedule() ? expiredScheduleMessage : "Không tải được danh sách thợ ở địa chỉ này.");
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
  }, [addressId, enabled, onAvailabilityChange, orderId, recurrenceCount, recurrenceUnit, requireSelection, scheduledAt, serviceId, selectedOptions, setError]);

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
