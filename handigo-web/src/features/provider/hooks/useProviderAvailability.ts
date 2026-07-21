import { useCallback, useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderAvailabilityStatus,
} from "../api/providerDashboard.api";

let hasInitializedProviderAvailability = false;

const getCurrentCoordinates = () =>
  new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      () => reject(new Error("Không thể lấy vị trí hiện tại.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });

export function useProviderAvailability(enabled = true) {
  const [availabilityStatus, setAvailabilityStatus] =
    useState<ProviderAvailabilityStatus>("offline");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const availabilityRequest = hasInitializedProviderAvailability
      ? providerDashboardApi.overview()
      : providerDashboardApi.updateAvailability("offline");
    hasInitializedProviderAvailability = true;

    availabilityRequest
      .then((overview) => {
        if (!cancelled) {
          setAvailabilityStatus(overview.availabilityStatus || "offline");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailabilityStatus("offline");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const keepOffline = () => {
      setAvailabilityStatus("offline");
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
    if (!enabled || isUpdating) return;

    const previousStatus = availabilityStatus;
    const nextStatus = availabilityStatus === "online" ? "offline" : "online";
    setAvailabilityStatus(nextStatus);
    setIsUpdating(true);

    try {
      if (nextStatus === "online") {
        try {
          const coordinates = await getCurrentCoordinates();
          await providerDashboardApi.updateCurrentLocation(
            coordinates.latitude,
            coordinates.longitude,
          );
        } catch {
          setAvailabilityStatus(previousStatus);
          window.alert(
            "Vui lòng cho phép truy cập vị trí để bật trạng thái sẵn sàng nhận đơn.",
          );
          return;
        }
      }

      const result = await providerDashboardApi.updateAvailability(nextStatus);
      setAvailabilityStatus(result.availabilityStatus);
    } catch {
      setAvailabilityStatus(previousStatus);
      window.alert("Không thể cập nhật trạng thái hoạt động. Vui lòng thử lại.");
    } finally {
      setIsUpdating(false);
    }
  }, [availabilityStatus, enabled, isUpdating]);

  return {
    availabilityStatus,
    isOnline: availabilityStatus === "online",
    isUpdating,
    toggleAvailability,
  };
}
