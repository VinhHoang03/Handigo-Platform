import { useCallback, useEffect } from "react";
import {
  providerDashboardApi,
  type ProviderAvailabilityStatus,
} from "../api/providerDashboard.api";
import { useSystemAlert } from "@/components/common/SystemAlert";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderAvailabilityStore } from "../store/providerAvailability.store";

const getCurrentCoordinates = () =>
  new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEOLOCATION_NOT_SUPPORTED"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });

export function useProviderAvailability(enabled = true) {
  const { showSystemAlert } = useSystemAlert();
  const providerUserId = useAuthStore(
    (state) => state.user?.id || state.user?._id || null,
  );
  const storedProviderUserId = useProviderAvailabilityStore(
    (state) => state.providerUserId,
  );
  const storedAvailabilityStatus = useProviderAvailabilityStore(
    (state) => state.availabilityStatus,
  );
  const isUpdating = useProviderAvailabilityStore(
    (state) => state.isUpdating,
  );
  const availabilityStatus: ProviderAvailabilityStatus =
    enabled && storedProviderUserId === providerUserId
      ? storedAvailabilityStatus
      : "offline";

  useEffect(() => {
    if (!enabled || !providerUserId) return;

    const store = useProviderAvailabilityStore.getState();
    if (!store.startInitialization(providerUserId)) return;

    void providerDashboardApi
      .overview()
      .then((overview) => {
        useProviderAvailabilityStore
          .getState()
          .completeInitialization(
            providerUserId,
            overview.availabilityStatus || "offline",
          );
      })
      .catch(() => {
        useProviderAvailabilityStore
          .getState()
          .completeInitialization(providerUserId, "offline");
      });
  }, [enabled, providerUserId]);

  useEffect(() => {
    if (!enabled) return;

    const keepOffline = () => {
      useProviderAvailabilityStore
        .getState()
        .setAvailabilityStatus("offline");
    };
    const persistOfflineAfterReconnect = () => {
      keepOffline();
      void providerDashboardApi.updateAvailability("offline").catch(() => undefined);
    };

    window.addEventListener("offline", keepOffline);
    window.addEventListener("online", persistOfflineAfterReconnect);

    return () => {
      window.removeEventListener("offline", keepOffline);
      window.removeEventListener("online", persistOfflineAfterReconnect);
    };
  }, [enabled]);

  const toggleAvailability = useCallback(async () => {
    const store = useProviderAvailabilityStore.getState();
    if (!enabled || store.isUpdating) return;

    const previousStatus = store.availabilityStatus;
    const nextStatus = previousStatus === "online" ? "offline" : "online";
    store.setAvailabilityStatus(nextStatus);
    store.setIsUpdating(true);

    try {
      if (nextStatus === "online") {
        void getCurrentCoordinates()
          .then((coordinates) =>
            providerDashboardApi.updateCurrentLocation(
              coordinates.latitude,
              coordinates.longitude,
            ),
          )
          .catch(() => undefined);
      }

      const result = await providerDashboardApi.updateAvailability(nextStatus);
      useProviderAvailabilityStore
        .getState()
        .setAvailabilityStatus(result.availabilityStatus);
    } catch {
      useProviderAvailabilityStore
        .getState()
        .setAvailabilityStatus(previousStatus);
      showSystemAlert(
        "Không thể cập nhật trạng thái hoạt động. Vui lòng thử lại.",
        { title: "Cập nhật trạng thái thất bại", variant: "error" },
      );
    } finally {
      useProviderAvailabilityStore.getState().setIsUpdating(false);
    }
  }, [enabled, showSystemAlert]);

  return {
    availabilityStatus,
    isOnline: availabilityStatus === "online",
    isUpdating,
    toggleAvailability,
  };
}
