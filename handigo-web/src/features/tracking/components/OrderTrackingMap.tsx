import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import type { Address, Order } from "@/types/booking";
import {
  trackingApi,
  type TrackingRoute,
} from "@/features/tracking/api/tracking.api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Coordinate = {
  latitude: number;
  longitude: number;
  updatedAt?: string;
};

type TrackingState = {
  customer: Coordinate | null;
  provider: Coordinate | null;
};

type LocationEvent = Coordinate & {
  ownerType: "customer" | "provider";
};

interface OrderTrackingMapProps {
  order: Order;
  viewerRole: "CUSTOMER" | "PROVIDER";
  compact?: boolean;
}

type TrackingPointKey = "customer" | "provider";

type TrackingPoint = {
  key: TrackingPointKey;
  label: string;
  shortLabel: string;
  color: string;
  accentColor: string;
  coordinate: Coordinate;
  displayText: string;
  updatedAtLabel: string;
  icon: string;
};

// ─── i18n text ────────────────────────────────────────────────────────────────

const mapText = {
  connecting: "Đang kết nối vị trí realtime...",
  ready: "Đã đồng bộ vị trí từ hệ thống tracking.",
  missingCoordinate:
    "Địa chỉ đơn hàng chưa có toạ độ. Vui lòng chọn địa chỉ từ gợi ý Google Maps hoặc cập nhật địa chỉ có kinh độ và vĩ độ.",
  customerMarker: "Vị trí khách hàng",
  serviceAddressMarker: "Địa chỉ thực hiện dịch vụ",
  providerMarker: "Vị trí kỹ thuật viên",
  connected: "Đã kết nối tracking realtime.",
  joinFailed: "Không thể tham gia tracking của đơn hàng.",
  locationPermission: "Hãy cho phép truy cập vị trí để chia sẻ hành trình realtime.",
  locationUnsupported: "Trình duyệt không hỗ trợ chia sẻ vị trí realtime.",
  customerLabel: "khách hàng",
  realtimeTitle: "Theo dõi vị trí realtime",
  addressTitle: "Bản đồ vị trí đơn hàng",
  fallbackAddress: "Bản đồ hiển thị theo toạ độ đã lưu trong đơn hàng.",
  liveBadge: "Trực tiếp",
  addressLegend: "Khách hàng",
  providerLegend: "Kỹ thuật viên",
  lastUpdated: "Cập nhật",
  waitingProvider: "Đang chờ toạ độ kỹ thuật viên...",
  distancePrefix: "Khoảng cách",
  bothLocationNote: "đều xem được vị trí hiện tại của nhau khi hai bên cho phép chia sẻ vị trí.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const canShareLiveLocation = (status: Order["status"]) =>
  status === "accepted" || status === "in_progress";

const getOrderAddress = (order: Order) =>
  typeof order.addressId === "object" && order.addressId
    ? (order.addressId as Address)
    : null;

const getAddressLine = (address: Address | null) => {
  if (!address) return "";
  return (
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
  );
};

const isValidCoordinate = (coordinate: Coordinate | null | undefined) =>
  Boolean(
    coordinate &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180,
  );

const getAddressCoordinate = (address: Address | null): Coordinate | null => {
  if (!address) return null;
  const coordinate = {
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
  };
  return isValidCoordinate(coordinate) ? coordinate : null;
};

/**
 * Geocode một địa chỉ văn bản qua Nominatim (OpenStreetMap) — không cần API key.
 * Trả về toạ độ hoặc null nếu không tìm thấy.
 */
const geocodeAddressViaNominatim = async (
  fullAddress: string,
): Promise<Coordinate | null> => {
  if (!fullAddress.trim()) return null;
  try {
    const query = encodeURIComponent(fullAddress + ", Việt Nam");
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=vn`;
    const response = await fetch(url, {
      headers: { "Accept-Language": "vi", "User-Agent": "Handigo-App/1.0" },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (!results.length) return null;
    const coordinate = {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };
    return isValidCoordinate(coordinate) ? coordinate : null;
  } catch {
    return null;
  }
};

const formatCoordinate = (coordinate: Coordinate) =>
  coordinate.latitude.toFixed(5) + ", " + coordinate.longitude.toFixed(5);

const formatUpdatedAt = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const haversineDistanceInMeters = (from: Coordinate, to: Coordinate) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) =>
  meters >= 1000 ? (meters / 1000).toFixed(1) + " km" : Math.round(meters) + " m";

const hasGeolocationSupport = () =>
  typeof navigator !== "undefined" && "geolocation" in navigator;

const toLatLng = (c: Coordinate): [number, number] => [c.latitude, c.longitude];
const ROUTE_REFRESH_INTERVAL_MS = 20_000;
const MIN_ROUTE_REFRESH_DISTANCE_METERS = 50;

// ─── Custom Leaflet marker HTML factory ───────────────────────────────────────

const createCustomIcon = (shortLabel: string, color: string, pulse: boolean) => {
  const pulseRing = pulse
    ? `<span style="
        position:absolute;inset:-6px;border-radius:50%;
        border:2px solid ${color};opacity:0.4;
        animation:trackPulse 2s ease-out infinite;"></span>`
    : "";
  const html = `
    <div style="position:relative;width:40px;height:40px;">
      ${pulseRing}
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 3px 12px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:700;color:#fff;z-index:1;
        letter-spacing:0.5px;
      ">${shortLabel}</div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
};

const createPopupContent = (point: TrackingPoint) => {
  const container = document.createElement("div");
  container.style.minWidth = "160px";

  const title = document.createElement("p");
  title.style.cssText =
    "margin:0 0 4px;font-weight:700;font-size:13px;color:#131b2e";
  title.textContent = point.label;
  container.appendChild(title);

  const location = document.createElement("p");
  location.style.cssText = "margin:0;font-size:11px;color:#6b7280";
  location.textContent = point.displayText;
  container.appendChild(location);

  if (point.updatedAtLabel !== "--") {
    const updatedAt = document.createElement("p");
    updatedAt.style.cssText =
      "margin:4px 0 0;font-size:11px;color:#9ca3af";
    updatedAt.textContent =
      mapText.lastUpdated + ": " + point.updatedAtLabel;
    container.appendChild(updatedAt);
  }

  return container;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderTrackingMap({
  order,
  viewerRole,
  compact = false,
}: OrderTrackingMapProps) {
  const address = getOrderAddress(order);
  const addressLine = getAddressLine(address);
  const trackingEnabled = Boolean(order.providerId);
  const liveTrackingEnabled = trackingEnabled && canShareLiveLocation(order.status);
  const savedCustomerCoordinate = useMemo(() => getAddressCoordinate(address), [address]);

  const socketRef = useRef<Socket | null>(null);
  const lastSentAtRef = useRef(0);
  const lastRouteRequestAtRef = useRef(0);
  const lastRoutedProviderRef = useRef<Coordinate | null>(null);
  const routeRequestRef = useRef<AbortController | null>(null);
  const routeOrderIdRef = useRef(order._id);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Partial<Record<TrackingPointKey, L.Marker>>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [tracking, setTracking] = useState<TrackingState>({
    customer: savedCustomerCoordinate,
    provider: null,
  });
  const [trackingRoute, setTrackingRoute] = useState<TrackingRoute | null>(null);
  // Toạ độ được geocode từ Nominatim khi address không có lat/lng trong DB
  const [geocodedCoordinate, setGeocodedCoordinate] = useState<Coordinate | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    liveTrackingEnabled && !hasGeolocationSupport()
      ? mapText.locationUnsupported
      : liveTrackingEnabled
        ? mapText.connecting
        : mapText.ready,
  );

  // Tự động geocode địa chỉ qua Nominatim khi address thiếu toạ độ
  useEffect(() => {
    if (savedCustomerCoordinate) return; // Đã có toạ độ từ DB → không cần geocode
    const fullAddress = address?.fullAddress?.trim();
    if (!fullAddress) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsGeocoding(true);
    geocodeAddressViaNominatim(fullAddress).then((result) => {
      if (!cancelled) {
        setGeocodedCoordinate(result);
        setIsGeocoding(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address?.fullAddress, savedCustomerCoordinate]);

  // Socket connection
  useEffect(() => {
    if (!trackingEnabled) return;

    console.log(`[Socket-Client] Connecting for order ${order._id} as ${viewerRole}...`);
    const { socket, dispose } = createAuthenticatedSocket({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    const joinOrderRoom = () => {
      console.log(`[Socket-Client] Connected! Socket ID: ${socket.id}`);
      socket.emit(
        "order:tracking:join",
        { orderId: order._id },
        (response: { success: boolean; data?: TrackingState; message?: string }) => {
          console.log("[Socket-Client] order:tracking:join response:", response);
          if (response.success) {
            setTracking((cur) => ({
              customer: cur.customer,
              provider: response.data?.provider || cur.provider,
            }));
            setLocationMessage(mapText.connected);
            lastSentAtRef.current = 0;
          } else {
            setLocationMessage(response.message || mapText.joinFailed);
          }
        },
      );
    };

    const handleConnectError = (err: Error) => {
      console.error("[Socket-Client] Connection error:", err.message);
      setLocationMessage(`Lỗi kết nối định vị: ${err.message}`);
    };

    socket.on("connect", joinOrderRoom);
    socket.on("connect_error", handleConnectError);

    const handleLocation = (location: LocationEvent) => {
      console.log("[Socket-Client] order:location received:", location);
      if (location.ownerType === "provider") {
        setTracking((cur) => ({ ...cur, provider: location }));
      } else if (location.ownerType === "customer") {
        setTracking((cur) => ({ ...cur, customer: location }));
      }
    };
    socket.on("order:location", handleLocation);

    return () => {
      console.log("[Socket-Client] Cleaning up socket connection...");
      socket.off("connect", joinOrderRoom);
      socket.off("connect_error", handleConnectError);
      socket.off("order:location", handleLocation);
      dispose();
      socketRef.current = null;
    };
  }, [order._id, trackingEnabled, viewerRole]);


  // GPS watchPosition — chỉ dành cho PROVIDER.
  // Customer không cần GPS: toạ độ của customer luôn là địa chỉ tĩnh từ đơn hàng.
  useEffect(() => {
    if (!liveTrackingEnabled || !hasGeolocationSupport()) return;
    if (viewerRole !== "PROVIDER") return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const nextCoordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          updatedAt: new Date().toISOString(),
        };

        // Cập nhật vị trí provider ngay lập tức trên local map
        setTracking((cur) => ({ ...cur, provider: nextCoordinate }));

        // Gửi lên server mỗi 10 giây để giảm tần suất chia sẻ GPS.
        if (now - lastSentAtRef.current < 10_000) return;
        lastSentAtRef.current = now;
        socketRef.current?.emit(
          "order:location:update",
          { orderId: order._id, ...nextCoordinate },
          (res: { success: boolean; message?: string } | undefined) => {
            if (res && !res.success) {
              console.warn("[Socket-Client] order:location:update failed:", res.message);
            } else {
              console.log("[Socket-Client] order:location:update ack:", res);
            }
          },
        );
      },
      (err) => {
        console.error("[Socket-Client] GPS watchPosition error:", err.message);
        setLocationMessage(mapText.locationPermission);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [liveTrackingEnabled, order._id, viewerRole]);


  // Toạ độ customer: ưu tiên toạ độ từ DB, fallback sang Nominatim geocode.
  // Không bao giờ dùng GPS của customer — luôn là địa chỉ đặt dịch vụ (tĩnh).
  const customerCoordinate = savedCustomerCoordinate ?? geocodedCoordinate;
  const providerCoordinate = isValidCoordinate(tracking.provider) ? tracking.provider : null;

  useEffect(() => {
    if (routeOrderIdRef.current !== order._id) {
      routeOrderIdRef.current = order._id;
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
        order._id,
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
  }, [
    customerCoordinate,
    liveTrackingEnabled,
    order._id,
    providerCoordinate,
  ]);

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
            color: "#4f46e5",
            accentColor: "#818cf8",
            coordinate: customerCoordinate,
            displayText: addressLine || formatCoordinate(customerCoordinate),
            updatedAtLabel: formatUpdatedAt(customerCoordinate.updatedAt),
            icon: "person_pin_circle",
          }
          : null,
        providerCoordinate
          ? {
            key: "provider" as const,
            label: mapText.providerMarker,
            shortLabel: "KTV",
            color: "#059669",
            accentColor: "#34d399",
            coordinate: providerCoordinate,
            displayText: formatCoordinate(providerCoordinate),
            updatedAtLabel: formatUpdatedAt(providerCoordinate.updatedAt),
            icon: "engineering",
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

  // ── Leaflet map init & update ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasMapCoordinate || !mapContainerRef.current) return;

    // Inject pulse keyframe once
    if (!document.getElementById("leaflet-track-style")) {
      const style = document.createElement("style");
      style.id = "leaflet-track-style";
      style.textContent = `
        @keyframes trackPulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-container {
          font-family: 'Inter', sans-serif !important;
          border-radius: 0 !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(19,27,46,0.15);
          border: 1px solid rgba(199,196,216,0.5);
          padding: 0;
        }
        .custom-popup .leaflet-popup-content {
          margin: 12px 16px;
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(255,255,255,0.97);
        }
      `;
      document.head.appendChild(style);
    }

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
        color: "#4f46e5",
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
      routeRequestRef.current?.abort();
      routeLineRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (!address) return null;

  return (
    <section className="glass-card overflow-hidden rounded-3xl border border-outline-variant/30">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: 22 }}
            >
              my_location
            </span>
            <h2 className="font-headline-md text-on-surface">
              {liveTrackingEnabled ? mapText.realtimeTitle : mapText.addressTitle}
            </h2>
          </div>
          <p className="text-sm text-on-surface-variant">
            {liveTrackingEnabled
              ? `Bạn và ${otherPartyLabel} ${mapText.bothLocationNote}`
              : addressLine || mapText.fallbackAddress}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {liveTrackingEnabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {mapText.liveBadge}
            </span>
          )}
          {distanceLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                straighten
              </span>
              {distanceLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Map area ── */}
      <div
        className={`relative w-full overflow-hidden bg-surface-container-low ${
          compact ? "h-[320px] sm:h-[360px]" : "h-[400px] sm:h-[460px]"
        }`}
      >
        {hasMapCoordinate ? (
          <div
            ref={mapContainerRef}
            className="h-full w-full"
            aria-label="Bản đồ theo dõi vị trí realtime"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="flex max-w-2xl items-center gap-4 rounded-2xl bg-white/95 px-6 py-6 text-left shadow-lg ring-1 ring-outline-variant/30">
              {isGeocoding ? (
                <>
                  <span
                    className="material-symbols-outlined shrink-0 animate-spin text-primary"
                    style={{ fontSize: 40 }}
                  >
                    progress_activity
                  </span>
                  <p className="text-sm font-semibold text-on-surface">
                    Đang xác định toạ độ địa chỉ...
                  </p>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined shrink-0 text-amber-500"
                    style={{ fontSize: 40 }}
                  >
                    location_off
                  </span>
                  <p className="text-sm font-semibold leading-relaxed text-on-surface">
                    {mapText.missingCoordinate}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Status overlay */}
        {locationMessage && hasMapCoordinate && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-on-surface shadow-md ring-1 ring-outline-variant/30 backdrop-blur-sm"
            style={{ maxWidth: "calc(100% - 32px)", textOverflow: "ellipsis", overflow: "hidden" }}
          >
            {providerCoordinate || !trackingEnabled ? locationMessage : mapText.waitingProvider}
          </div>
        )}
      </div>

      {/* ── Legend strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 px-6 py-3">
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
            <span
              className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm"
              style={{ background: "#4f46e5" }}
            />
            {mapText.addressLegend}
          </span>
          {trackingEnabled && (
            <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <span
                className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm"
                style={{ background: "#059669" }}
              />
              {mapText.providerLegend}
            </span>
          )}
          {customerCoordinate && providerCoordinate && (
            <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <span
                className="inline-block h-0.5 w-6 rounded-full"
                style={{
                  background: "repeating-linear-gradient(90deg,#4f46e5 0,#4f46e5 5px,transparent 5px,transparent 9px)",
                }}
              />
              Tuyến đường
            </span>
          )}
        </div>
      </div>

      {/* ── Info cards ── */}
      {hasMapCoordinate && (
        <div className="grid gap-3 border-t border-outline-variant/20 p-6 sm:grid-cols-2">
          {points.map((point) => (
            <div
              key={point.key}
              className="group relative overflow-hidden rounded-2xl bg-surface-container-low px-5 py-4 ring-1 ring-outline-variant/20 transition hover:ring-outline-variant/50"
            >
              {/* Color accent bar */}
              <span
                className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                style={{ background: point.color }}
              />
              <div className="flex items-start justify-between gap-2 pl-2">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: point.color }}
                  >
                    {point.key === "customer" ? "person_pin_circle" : "engineering"}
                  </span>
                  <p className="text-sm font-bold text-on-surface">{point.label}</p>
                </div>
                {point.updatedAtLabel !== "--" && (
                  <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                    {point.updatedAtLabel}
                  </span>
                )}
              </div>
              <p className={`mt-2 pl-2 text-xs text-on-surface-variant ${point.key === "provider" ? "font-mono" : "leading-5"}`}>
                {point.displayText}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
