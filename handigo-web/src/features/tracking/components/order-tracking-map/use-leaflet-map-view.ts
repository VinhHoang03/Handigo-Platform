import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { TRACKING_COLORS } from "./constants";
import { toLatLng } from "./geo-helpers";
import { createCustomIcon, createPopupContent, injectTrackingMapStyles } from "./leaflet-marker-factory";
import type { Coordinate, TrackingPoint, TrackingPointKey } from "./types";

interface UseLeafletMapViewParams {
  hasMapCoordinate: boolean;
  points: TrackingPoint[];
  liveTrackingEnabled: boolean;
  customerCoordinate: Coordinate | null;
  providerCoordinate: Coordinate | null;
  hasRoadRoute: boolean;
  routePath: [number, number][];
}

/** Khởi tạo, cập nhật marker/polyline Leaflet và dọn dẹp khi unmount. */
export function useLeafletMapView({
  hasMapCoordinate,
  points,
  liveTrackingEnabled,
  customerCoordinate,
  providerCoordinate,
  hasRoadRoute,
  routePath,
}: UseLeafletMapViewParams) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Partial<Record<TrackingPointKey, L.Marker>>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!hasMapCoordinate || !mapContainerRef.current) return;

    // Inject pulse keyframe once
    injectTrackingMapStyles();

    const firstPoint = points[0];

    // Init map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: toLatLng(firstPoint.coordinate),
        zoom: points.length > 1 ? 14 : 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Tile layer – CartoDB Voyager (clean, modern, free)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
        },
      ).addTo(mapRef.current);

      // Custom zoom control position
      L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

      // Subtle attribution
      L.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://carto.com">CARTO</a> | © <a href="https://www.openstreetmap.org">OSM</a>')
        .addTo(mapRef.current);
    }

    // Update / create markers
    for (const point of points) {
      const latlng = toLatLng(point.coordinate);
      const pulse = liveTrackingEnabled;
      const icon = createCustomIcon(point.shortLabel, point.color, pulse);
      const popupContent = createPopupContent(point);

      const existing = markersRef.current[point.key];
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.getPopup()?.setContent(popupContent);
      } else {
        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current!)
          .bindPopup(popupContent, { className: "custom-popup", closeButton: false, offset: [0, -8] });
        markersRef.current[point.key] = marker;
      }
    }

    // Remove stale markers
    (["customer", "provider"] as const).forEach((key) => {
      if (!points.some((p) => p.key === key)) {
        markersRef.current[key]?.remove();
        delete markersRef.current[key];
      }
    });

    // Tuyến đường OSRM; fallback về đường thẳng nét đứt khi routing lỗi.
    if (customerCoordinate && providerCoordinate) {
      const path: [number, number][] = hasRoadRoute
        ? routePath
        : [
          toLatLng(providerCoordinate),
          toLatLng(customerCoordinate),
        ];
      const routeStyle: L.PathOptions = {
        color: TRACKING_COLORS.customer,
        weight: hasRoadRoute ? 5 : 3,
        opacity: hasRoadRoute ? 0.82 : 0.65,
        dashArray: hasRoadRoute ? undefined : "8 8",
        lineCap: "round",
        lineJoin: "round",
      };
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(path);
        routeLineRef.current.setStyle(routeStyle);
      } else {
        routeLineRef.current = L.polyline(path, routeStyle).addTo(
          mapRef.current!,
        );
      }
    } else {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    }

    // Fit bounds
    if (points.length > 1) {
      const bounds = L.latLngBounds(
        hasRoadRoute
          ? routePath
          : points.map((p) => toLatLng(p.coordinate)),
      );
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    } else {
      mapRef.current.setView(toLatLng(firstPoint.coordinate), 16);
    }
  }, [
    customerCoordinate,
    hasRoadRoute,
    providerCoordinate,
    hasMapCoordinate,
    liveTrackingEnabled,
    points,
    routePath,
  ]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      Object.values(markersRef.current).forEach((m) => m?.remove());
      routeLineRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return mapContainerRef;
}
