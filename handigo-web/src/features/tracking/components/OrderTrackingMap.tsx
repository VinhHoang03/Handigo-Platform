import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { tokenStorage } from "@/api/tokenStorage";
import type { Address, Order } from "@/types/booking";

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderTrackingMap({ order, viewerRole }: OrderTrackingMapProps) {
  const address = getOrderAddress(order);
  const addressLine = getAddressLine(address);
  const trackingEnabled = Boolean(order.providerId);
  const liveTrackingEnabled = trackingEnabled && canShareLiveLocation(order.status);
  const savedCustomerCoordinate = useMemo(() => getAddressCoordinate(address), [address]);

  const socketRef = useRef<Socket | null>(null);
  const lastSentAtRef = useRef(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Partial<Record<TrackingPointKey, L.Marker>>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [tracking, setTracking] = useState<TrackingState>({
    customer: savedCustomerCoordinate,
    provider: null,
  });
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
    const token = tokenStorage.get();
    if (!trackingEnabled || !token) return;

    console.log(`[Socket-Client] Connecting for order ${order._id} as ${viewerRole}...`);
    const socket = io(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000", {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[Socket-Client] Connected! Socket ID: ${socket.id}`);
    });

    socket.on("reconnect", (attempt: number) => {
      console.log(`[Socket-Client] Reconnected after ${attempt} attempt(s). Rejoining order room...`);
      // Rejoin phòng sau khi reconnect để không bị miss broadcast
      socket.emit(
        "order:tracking:join",
        { orderId: order._id },
        (response: { success: boolean; data?: TrackingState; message?: string }) => {
          console.log("[Socket-Client] Rejoin after reconnect:", response);
          if (response.success && response.data?.provider) {
            setTracking((cur) => ({
              customer: cur.customer,
              provider: response.data!.provider || cur.provider,
            }));
          }
        },
      );
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket-Client] Connection error:", err.message);
      setLocationMessage(`Lỗi kết nối định vị: ${err.message}`);
    });

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
          // Reset throttle timer để provider emit vị trí ngay sau khi join thành công
          lastSentAtRef.current = 0;
        } else {
          setLocationMessage(response.message || mapText.joinFailed);
        }
      },
    );

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
      socket.off("order:location", handleLocation);
      socket.disconnect();
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

        // Gửi lên server mỗi 5 giây để tránh quá tải socket
        if (now - lastSentAtRef.current < 5000) return;
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
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [liveTrackingEnabled, order._id, viewerRole]);


  // Toạ độ customer: ưu tiên toạ độ từ DB, fallback sang Nominatim geocode.
  // Không bao giờ dùng GPS của customer — luôn là địa chỉ đặt dịch vụ (tĩnh).
  const customerCoordinate = savedCustomerCoordinate ?? geocodedCoordinate;
  const providerCoordinate = isValidCoordinate(tracking.provider) ? tracking.provider : null;

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

  const distanceLabel =
    customerCoordinate && providerCoordinate
      ? formatDistance(haversineDistanceInMeters(customerCoordinate, providerCoordinate))
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
      const popupHtml = `
        <div style="min-width:160px">
          <p style="margin:0 0 4px;font-weight:700;font-size:13px;color:#131b2e">${point.label}</p>
          <p style="margin:0;font-size:11px;color:#6b7280">${escapeHtml(point.displayText)}</p>
          ${point.updatedAtLabel !== "--" ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af">${mapText.lastUpdated}: ${point.updatedAtLabel}</p>` : ""}
        </div>
      `;

      const existing = markersRef.current[point.key];
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.getPopup()?.setContent(popupHtml);
      } else {
        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current!)
          .bindPopup(popupHtml, { className: "custom-popup", closeButton: false, offset: [0, -8] });
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

    // Dashed polyline between customer & provider
    if (customerCoordinate && providerCoordinate) {
      const path: [number, number][] = [
        toLatLng(customerCoordinate),
        toLatLng(providerCoordinate),
      ];
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(path);
      } else {
        routeLineRef.current = L.polyline(path, {
          color: "#4f46e5",
          weight: 3,
          opacity: 0.65,
          dashArray: "8 8",
          lineCap: "round",
        }).addTo(mapRef.current!);
      }
    } else {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    }

    // Fit bounds
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => toLatLng(p.coordinate)));
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    } else {
      mapRef.current.setView(toLatLng(firstPoint.coordinate), 16);
    }
  }, [
    customerCoordinate,
    providerCoordinate,
    hasMapCoordinate,
    liveTrackingEnabled,
    points,
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
      <div className="relative h-[400px] w-full overflow-hidden bg-surface-container-low sm:h-[460px]">
        {hasMapCoordinate ? (
          <div
            ref={mapContainerRef}
            className="h-full w-full"
            aria-label="Bản đồ theo dõi vị trí realtime"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="max-w-sm rounded-2xl bg-white/95 px-6 py-6 shadow-lg ring-1 ring-outline-variant/30">
              {isGeocoding ? (
                <>
                  <span
                    className="material-symbols-outlined animate-spin text-primary"
                    style={{ fontSize: 40 }}
                  >
                    progress_activity
                  </span>
                  <p className="mt-3 text-sm font-semibold text-on-surface">
                    Đang xác định toạ độ địa chỉ...
                  </p>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-amber-500"
                    style={{ fontSize: 40 }}
                  >
                    location_off
                  </span>
                  <p className="mt-3 text-sm font-semibold text-on-surface leading-relaxed">
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
