import { useCallback, useEffect, useState } from "react";
import {
  providerDashboardApi,
  type ProviderAvailabilityStatus,
} from "../api/providerDashboard.api";

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
