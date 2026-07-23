import { useMemo } from "react";
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
  const providerCoordinate = isValidCoordinate(tracking.provider) ? tracking.provider : null;

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

  const mapContainerRef = useLeafletMapView({
    hasMapCoordinate,
    points,
    liveTrackingEnabled,
    customerCoordinate,
    providerCoordinate,
    hasRoadRoute,
    routePath,
  });

  return {
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
