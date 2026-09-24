import { useMatchingProviders } from "./use-matching-providers";
import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/types/booking";
import { mapText, TRACKING_COLORS } from "./constants";
import {
  canShareLiveLocation,
  formatCoordinate,
  formatDistance,
  formatUpdatedAt,
  getAddressCoordinate,
  getAddressLine,
  getOrderAddress,
  haversineDistanceInMeters,
  isValidCoordinate,
} from "./geo-helpers";
import { useGeocodedAddress } from "./use-geocoded-address";
import { useLeafletMapView } from "./use-leaflet-map-view";
import { useRealtimeTracking } from "./use-realtime-tracking";
import { useTrackingRoute } from "./use-tracking-route";
import type { TrackingPoint } from "./types";
import { HardHat, MapPinned } from "lucide-react";

/** Toàn bộ state/refs/effects phục vụ vòng đời bản đồ theo dõi đơn hàng. */
export function useOrderTrackingMap(order: Order, viewerRole: "CUSTOMER" | "PROVIDER") {
  const [now, setNow] = useState(() => Date.now());
  const search = order.status === "created" && !order.providerId ? order.matchingSearch : null;
  useEffect(() => {
    if (!search) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [search]);
  const searchRadiusKm = search
    ? now >= new Date(search.expandsAt).getTime() ? search.expandedRadiusKm : search.initialRadiusKm
    : null;
  const searchMessage = search && searchRadiusKm
    ? now >= new Date(search.expiresAt).getTime()
      ? "Đã hết thời gian tìm thợ, đang cập nhật kết quả đơn hàng."
      : `Đang tìm thợ trong bán kính ${searchRadiusKm} km. ${now < new Date(search.expandsAt).getTime()
        ? `Mở rộng lên ${search.expandedRadiusKm} km sau ${Math.max(0, Math.ceil((new Date(search.expandsAt).getTime() - now) / 1000))} giây nếu chưa có thợ nhận.`
        : "Đã mở rộng phạm vi tìm kiếm; đơn sẽ tự hủy nếu hết thời gian mà chưa có thợ nhận."}`
    : null;
  const nearby = useMatchingProviders(order._id, searchRadiusKm,
    viewerRole === "CUSTOMER" && Boolean(search) && now < new Date(search!.expiresAt).getTime());
  const candidatePoints = useMemo<TrackingPoint[]>(() => nearby.providers.map((provider) => ({
    key: `candidate:${provider.providerId}`, label: "Kỹ thuật viên phù hợp", shortLabel: "KTV",
    color: TRACKING_COLORS.provider, accentColor: TRACKING_COLORS.providerAccent,
    coordinate: provider, displayText: `Cách địa chỉ đặt dịch vụ ${formatDistance(provider.distanceMeters)} (đường thẳng)`,
    updatedAtLabel: "--", icon: HardHat,
  })), [nearby.providers]);
  const address = getOrderAddress(order);
  const addressLine = getAddressLine(address);
  const trackingEnabled = Boolean(order.providerId);
  const liveTrackingEnabled = trackingEnabled && canShareLiveLocation(order.status);
  const savedCustomerCoordinate = useMemo(() => getAddressCoordinate(address), [address]);

  const { geocodedCoordinate, isGeocoding } = useGeocodedAddress(address, savedCustomerCoordinate);

  const { tracking, locationMessage } = useRealtimeTracking({
    orderId: order._id,
    viewerRole,
    trackingEnabled,
    liveTrackingEnabled,
    savedCustomerCoordinate,
  });

  // Toạ độ customer: ưu tiên toạ độ từ DB, fallback sang Nominatim geocode.
  // Không bao giờ dùng GPS của customer — luôn là địa chỉ đặt dịch vụ (tĩnh).
  const customerCoordinate = savedCustomerCoordinate ?? geocodedCoordinate;
  const providerCoordinate = trackingEnabled && isValidCoordinate(tracking.provider) ? tracking.provider : null;

  const trackingRoute = useTrackingRoute({
    orderId: order._id,
    liveTrackingEnabled,
    customerCoordinate,
    providerCoordinate,
  });

  // Customer pin luôn là "địa chỉ đặt dịch vụ", không phải vị trí GPS hiện tại
  const customerMarkerLabel = mapText.serviceAddressMarker;

  const points = useMemo<TrackingPoint[]>(
    () =>
      [
        customerCoordinate
          ? {
            key: "customer" as const,
            label: customerMarkerLabel,
            shortLabel: "KH",
            color: TRACKING_COLORS.customer,
            accentColor: TRACKING_COLORS.customerAccent,
            coordinate: customerCoordinate,
            displayText: addressLine || formatCoordinate(customerCoordinate),
            updatedAtLabel: formatUpdatedAt(customerCoordinate.updatedAt),
            icon: MapPinned,
          }
          : null,
        providerCoordinate
          ? {
            key: "provider" as const,
            label: mapText.providerMarker,
            shortLabel: "KTV",
            color: TRACKING_COLORS.provider,
            accentColor: TRACKING_COLORS.providerAccent,
            coordinate: providerCoordinate,
            displayText: formatCoordinate(providerCoordinate),
            updatedAtLabel: formatUpdatedAt(providerCoordinate.updatedAt),
            icon: HardHat,
          }
          : null,
      ].filter(Boolean) as TrackingPoint[],
    [addressLine, customerCoordinate, customerMarkerLabel, providerCoordinate],
  );

  const hasMapCoordinate = points.length > 0;

  const routePath = useMemo(
    () =>
      trackingRoute?.geometry.coordinates.map(
        ([longitude, latitude]) => [latitude, longitude] as [number, number],
      ) ?? [],
    [trackingRoute],
  );
  const hasRoadRoute = liveTrackingEnabled && routePath.length >= 2;

  const distanceLabel =
    customerCoordinate && providerCoordinate
      ? formatDistance(
        hasRoadRoute
          ? trackingRoute!.distanceMeters
          : haversineDistanceInMeters(customerCoordinate, providerCoordinate),
      )
      : null;

  const otherPartyLabel = viewerRole === "CUSTOMER" ? "kỹ thuật viên" : mapText.customerLabel;

  const mapPoints = useMemo(() => [...points, ...candidatePoints], [points, candidatePoints]);
  const mapContainerRef = useLeafletMapView({
    searchRadiusKm,
    hasMapCoordinate,
    points: mapPoints,
    liveTrackingEnabled,
    customerCoordinate,
    providerCoordinate,
    hasRoadRoute,
    routePath,
  });

  return {
    searchMessage,
    nearbyMessage: nearby.message,
    routeMessage: liveTrackingEnabled && providerCoordinate
      ? hasRoadRoute ? "Đường đi từ kỹ thuật viên đến địa chỉ đặt dịch vụ."
        : "Đang tải đường đi. Nét đứt thể hiện khoảng cách đường thẳng, chưa phải lộ trình di chuyển."
      : null,
    address,
    addressLine,
    trackingEnabled,
    liveTrackingEnabled,
    points,
    hasMapCoordinate,
    customerCoordinate,
    providerCoordinate,
    distanceLabel,
    otherPartyLabel,
    locationMessage,
    isGeocoding,
    mapContainerRef,
  };
}
