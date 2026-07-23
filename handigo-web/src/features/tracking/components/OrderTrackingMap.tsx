import { TrackingHeader } from "./order-tracking-map/TrackingHeader";
import { TrackingInfoCards } from "./order-tracking-map/TrackingInfoCards";
import { TrackingLegend } from "./order-tracking-map/TrackingLegend";
import { TrackingMapCanvas } from "./order-tracking-map/TrackingMapCanvas";
import { useOrderTrackingMap } from "./order-tracking-map/use-order-tracking-map";
import type { OrderTrackingMapProps } from "./order-tracking-map/types";

export function OrderTrackingMap({
  order,
  viewerRole,
  compact = false,
}: OrderTrackingMapProps) {
  const {
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
  } = useOrderTrackingMap(order, viewerRole);

  if (!address) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
      <TrackingHeader
        liveTrackingEnabled={liveTrackingEnabled}
        otherPartyLabel={otherPartyLabel}
        addressLine={addressLine}
        distanceLabel={distanceLabel}
      />

      <TrackingMapCanvas
        compact={compact}
        hasMapCoordinate={hasMapCoordinate}
        mapContainerRef={mapContainerRef}
        isGeocoding={isGeocoding}
        locationMessage={locationMessage}
        trackingEnabled={trackingEnabled}
        providerCoordinate={providerCoordinate}
      />

      <TrackingLegend
        trackingEnabled={trackingEnabled}
        customerCoordinate={customerCoordinate}
        providerCoordinate={providerCoordinate}
      />

      <TrackingInfoCards hasMapCoordinate={hasMapCoordinate} points={points} />
    </section>
  );
}
