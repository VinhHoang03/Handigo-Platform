import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { TRACKING_COLORS } from "./constants";
import { toLatLng } from "./geo-helpers";
import { createTechnicianIcon, createPopupContent, createServiceAddressIcon, injectTrackingMapStyles } from "./leaflet-marker-factory";
import type { Coordinate, TrackingPoint, TrackingPointKey } from "./types";

interface UseLeafletMapViewParams {
  searchRadiusKm?: number | null;
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
  searchRadiusKm,
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
  const searchCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!hasMapCoordinate || !mapContainerRef.current) return;

    // Inject pulse keyframe once
    injectTrackingMapStyles();

    const firstCoordinate = points[0]?.coordinate;
    if (!firstCoordinate) return;

    // Init map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: toLatLng(firstCoordinate),
        zoom: points.length > 1 ? 14 : 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Dùng cùng nguồn bản đồ với màn hình chọn địa chỉ.
      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxNativeZoom: 19,
          maxZoom: 20,
        },
      ).addTo(mapRef.current);

      // Custom zoom control position
      L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

      // Subtle attribution
      L.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>')
        .addTo(mapRef.current);
    }

    // Update / create markers
    for (const point of points) {
      const latlng = toLatLng(point.coordinate);
      const pulse = point.key === "provider" && liveTrackingEnabled;
      const icon = point.key === "customer"
        ? createServiceAddressIcon()
        : createTechnicianIcon(pulse);
      const popupContent = createPopupContent(point);

      const existing = markersRef.current[point.key];
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.getPopup()?.setContent(popupContent);
      } else {
        const marker = L.marker(latlng, { icon, zIndexOffset: point.key === "customer" ? 1000 : 0, title: point.label })
          .addTo(mapRef.current!)
          .bindPopup(popupContent, { className: "custom-popup", closeButton: false, offset: [0, -8] });
        markersRef.current[point.key] = marker;
      }
    }

    // Remove stale markers
    (Object.keys(markersRef.current) as TrackingPointKey[]).forEach((key) => {
      if (!points.some((p) => p.key === key)) {
        markersRef.current[key]?.remove();
        delete markersRef.current[key];
      }
    });

    if (!searchRadiusKm) {
      searchCircleRef.current?.remove();
      searchCircleRef.current = null;
    }

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

    if (searchRadiusKm && customerCoordinate) {
      if (!searchCircleRef.current) {
        searchCircleRef.current = L.circle(toLatLng(customerCoordinate), {
          radius: searchRadiusKm * 1000,
          color: TRACKING_COLORS.customer,
          fillOpacity: 0.12,
          interactive: false,
          weight: 2,
        }).addTo(mapRef.current);
      }
      searchCircleRef.current.setLatLng(toLatLng(customerCoordinate));
      searchCircleRef.current.setRadius(searchRadiusKm * 1000);
      mapRef.current.fitBounds(searchCircleRef.current.getBounds(), { padding: [24, 24] });
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(
        hasRoadRoute
          ? routePath
          : points.map((p) => toLatLng(p.coordinate)),
      );
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    } else {
      mapRef.current.setView(toLatLng(firstCoordinate), 16);
    }
  }, [
    searchRadiusKm,
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
      // StrictMode chạy lại effect với cùng refs: bỏ tham chiếu lớp của bản đồ cũ.
      markersRef.current = {};
      searchCircleRef.current?.remove();
      searchCircleRef.current = null;
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return mapContainerRef;
}
