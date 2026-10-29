import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { haversineDistanceInMeters, isValidCoordinate } from "@/features/tracking/components/order-tracking-map/geo-helpers";
import type { Coordinate } from "@/features/tracking/components/order-tracking-map/types";
import { resolveProviderWorkingAddress } from "../utils/providerWorkingArea";

type AddressResult = NonNullable<Awaited<ReturnType<typeof resolveProviderWorkingAddress>>>;

export function useProviderWorkingArea() {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [resolution, setResolution] = useState<{ key: string; result?: AddressResult; error?: string } | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const lastRequestAt = useRef(0);
  const coordinateKey = coordinate ? `${coordinate.latitude}:${coordinate.longitude}` : "";

  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      queueMicrotask(() => { if (active) setGpsError("Trình duyệt không hỗ trợ định vị GPS."); });
      return () => { active = false; };
    }
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      if (!active) return;
      const next = { latitude: coords.latitude, longitude: coords.longitude };
      if (!isValidCoordinate(next)) return;
      setGpsError("");
      setCoordinate((previous) => previous && haversineDistanceInMeters(previous, next) < 50 ? previous : next);
    }, (error) => {
      if (!active) return;
      setCoordinate(null);
      setGpsError(error.code === 1
        ? "Vui lòng cho phép truy cập vị trí để hiển thị khu vực làm việc theo GPS."
        : error.code === 3 ? "Lấy vị trí GPS mất quá lâu. Vui lòng thử lại."
          : "Chưa lấy được vị trí GPS. Vui lòng kiểm tra dịch vụ vị trí của thiết bị và thử lại.");
    }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
    return () => { active = false; navigator.geolocation.clearWatch(watchId); };
  }, [retryVersion]);

  useEffect(() => {
    if (!coordinate) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      lastRequestAt.current = Date.now();
      try {
        const result = await resolveProviderWorkingAddress(coordinate, () => active);
        if (active && result) setResolution({ key: coordinateKey, result });
      } catch (error) {
        if (active) setResolution({ key: coordinateKey, error: getErrorMessage(error, "Chưa tra cứu được địa chỉ GPS. Vui lòng thử lại.") });
      }
    }, Math.max(300, 15_000 - (Date.now() - lastRequestAt.current)));
    return () => { active = false; window.clearTimeout(timer); };
  }, [coordinate, coordinateKey, retryVersion]);

  const currentResolution = resolution?.key === coordinateKey ? resolution : null;
  const error = gpsError || currentResolution?.error || "";
  const retry = () => {
    setCoordinate(null); setResolution(null); setGpsError("");
    lastRequestAt.current = 0;
    setRetryVersion((version) => version + 1);
  };
  return { address: currentResolution?.result, error, loading: !error && !currentResolution?.result,
    locating: !coordinate, retry };
}
