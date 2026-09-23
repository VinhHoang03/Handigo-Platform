import { useEffect, useRef, useState } from "react";
import {
  trackingApi,
  type TrackingRoute,
} from "@/features/tracking/api/tracking.api";
import { haversineDistanceInMeters } from "./geo-helpers";
import { MIN_ROUTE_REFRESH_DISTANCE_METERS, ROUTE_REFRESH_INTERVAL_MS } from "./constants";
import type { Coordinate } from "./types";

interface UseTrackingRouteParams {
  orderId: string;
  liveTrackingEnabled: boolean;
  customerCoordinate: Coordinate | null;
  providerCoordinate: Coordinate | null;
}

/** Tuyến đường OSRM giữa provider và customer, refetch khi provider di chuyển đủ xa. */
export function useTrackingRoute({
  orderId,
  liveTrackingEnabled,
  customerCoordinate,
  providerCoordinate,
}: UseTrackingRouteParams) {
  const lastRouteRequestAtRef = useRef(0);
  const lastRoutedProviderRef = useRef<Coordinate | null>(null);
  const routeRequestRef = useRef<AbortController | null>(null);
  const routeOrderIdRef = useRef(orderId);

  const [trackingRoute, setTrackingRoute] = useState<TrackingRoute | null>(null);

  useEffect(() => {
    if (routeOrderIdRef.current !== orderId) {
      routeOrderIdRef.current = orderId;
      lastRouteRequestAtRef.current = 0;
      lastRoutedProviderRef.current = null;
      routeRequestRef.current?.abort();
      setTrackingRoute(null);
    }

    if (!liveTrackingEnabled || !customerCoordinate || !providerCoordinate) {
      return;
    }

    const now = Date.now();
    const movedDistance = lastRoutedProviderRef.current
      ? haversineDistanceInMeters(
        lastRoutedProviderRef.current,
        providerCoordinate,
      )
      : Number.POSITIVE_INFINITY;

    if (
      movedDistance < MIN_ROUTE_REFRESH_DISTANCE_METERS ||
      now - lastRouteRequestAtRef.current < ROUTE_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    lastRouteRequestAtRef.current = now;
    routeRequestRef.current?.abort();
    const controller = new AbortController();
    routeRequestRef.current = controller;
    const routedProviderCoordinate = providerCoordinate;

    void trackingApi
      .getOrderRoute(
        orderId,
        providerCoordinate,
        customerCoordinate,
        controller.signal,
      )
      .then((route) => {
        if (controller.signal.aborted) return;
        lastRoutedProviderRef.current = routedProviderCoordinate;
        setTrackingRoute(route);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn(
          "Không thể tải tuyến đường OSRM, sử dụng đường thẳng dự phòng:",
          error,
        );
        setTrackingRoute(null);
      });
  }, [customerCoordinate, liveTrackingEnabled, orderId, providerCoordinate]);

  // Huỷ request đang chờ khi component unmount.
  useEffect(() => () => {
    routeRequestRef.current?.abort();
  }, []);

  return trackingRoute;
}
