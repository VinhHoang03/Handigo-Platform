import { useCallback, useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderAvailabilityStatus,
} from "../api/providerDashboard.api";

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

export function useProviderAvailability() {
  const [availabilityStatus, setAvailabilityStatus] =
    useState<ProviderAvailabilityStatus>("offline");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    providerDashboardApi
      .overview()
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
  }, []);

  const toggleAvailability = useCallback(async () => {
    const nextStatus = availabilityStatus === "online" ? "offline" : "online";
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
          window.alert(
            "Vui lòng cho phép truy cập vị trí để bật trạng thái sẵn sàng nhận đơn.",
          );
          return;
        }
      }

      const result = await providerDashboardApi.updateAvailability(nextStatus);
      setAvailabilityStatus(result.availabilityStatus);
    } finally {
      setIsUpdating(false);
    }
  }, [availabilityStatus]);

  return {
    availabilityStatus,
    isOnline: availabilityStatus === "online",
    isUpdating,
    toggleAvailability,
  };
}
