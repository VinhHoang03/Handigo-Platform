import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { tokenStorage } from "@/api/tokenStorage";
import type { Address, Order } from "@/types/booking";
import {
  geocodeSavedAddress,
  loadGoogleMapsApi,
} from "@/features/customer/utils/googlePlacesAutocomplete";

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

interface MapInstance {
  setCenter: (position: MapPosition) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: BoundsInstance, padding: number) => void;
}

interface MarkerInstance {
  setMap: (map: MapInstance | null) => void;
  setPosition: (position: MapPosition) => void;
}

interface BoundsInstance {
  extend: (position: MapPosition) => void;
}

type MapPosition = { lat: number; lng: number };

interface GoogleMapsRuntime {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => MapInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  LatLngBounds: new () => BoundsInstance;
  SymbolPath: { CIRCLE: unknown };
}

const canShareLiveLocation = (status: Order["status"]) =>
  status === "accepted" || status === "in_progress";

export function OrderTrackingMap({
  order,
  viewerRole,
}: OrderTrackingMapProps) {
  const address = order.addressId as Address;
  const savedCustomerCoordinate =
    Number.isFinite(address.latitude) && Number.isFinite(address.longitude)
      ? {
          latitude: address.latitude!,
          longitude: address.longitude!,
        }
      : null;
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markersRef = useRef<{
    customer?: MarkerInstance;
    provider?: MarkerInstance;
  }>({});
  const socketRef = useRef<Socket | null>(null);
  const lastSentAtRef = useRef(0);
  const [tracking, setTracking] = useState<TrackingState>({
    customer: savedCustomerCoordinate,
    provider: null,
  });
  const [mapReady, setMapReady] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Đang kết nối vị trí realtime...",
  );

  useEffect(() => {
    if (
      Number.isFinite(address.latitude) &&
      Number.isFinite(address.longitude)
    ) {
      return;
    }

    if (!address.fullAddress) return;
    void geocodeSavedAddress(address.fullAddress)
      .then((coordinate) => {
        setTracking((current) => ({
          ...current,
          customer: current.customer || coordinate,
        }));
      })
      .catch(() => undefined);
  }, [
    address.fullAddress,
    address.latitude,
    address.longitude,
  ]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMapsApi()
      .then(() => {
        if (cancelled || !mapElementRef.current) return;
        const maps = (window.google as unknown as { maps?: GoogleMapsRuntime })
          ?.maps;
        if (!maps) return;
        mapRef.current = new maps.Map(mapElementRef.current, {
          center: { lat: 10.7769, lng: 106.7009 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setMapReady(true);
      })
      .catch(() => {
        setLocationMessage("Không tải được Google Maps. Vui lòng kiểm tra cấu hình bản đồ.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const maps = (window.google as unknown as { maps?: GoogleMapsRuntime })
      ?.maps;
    if (!maps) return;

    const points: MapPosition[] = [];
    const updateMarker = (
      key: "customer" | "provider",
      coordinate: Coordinate | null,
      title: string,
      color: string,
    ) => {
      if (!coordinate) {
        markersRef.current[key]?.setMap(null);
        delete markersRef.current[key];
        return;
      }

      const position = {
        lat: coordinate.latitude,
        lng: coordinate.longitude,
      };
      points.push(position);
      if (!markersRef.current[key]) {
        markersRef.current[key] = new maps.Marker({
          map: mapRef.current,
          position,
          title,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      } else {
        markersRef.current[key].setPosition(position);
      }
    };

    updateMarker("customer", tracking.customer, "Vị trí khách hàng", "#2563eb");
    updateMarker("provider", tracking.provider, "Vị trí provider", "#16a34a");

    if (points.length === 1) {
      mapRef.current.setCenter(points[0]);
      mapRef.current.setZoom(15);
    } else if (points.length > 1) {
      const bounds = new maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 70);
    }
  }, [mapReady, tracking]);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token || !order.providerId) return;

    const socket = io(
      import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
      { auth: { token } },
    );
    socketRef.current = socket;

    socket.emit(
      "order:tracking:join",
      { orderId: order._id },
      (response: {
        success: boolean;
        data?: TrackingState;
        message?: string;
      }) => {
        if (response.success && response.data) {
          setTracking((current) => ({
            customer: response.data?.customer || current.customer,
            provider: response.data?.provider || current.provider,
          }));
          setLocationMessage("Đã kết nối tracking realtime.");
        } else {
          setLocationMessage(response.message || "Không thể tham gia tracking của đơn hàng.");
        }
      },
    );

    const handleLocation = (location: LocationEvent) => {
      setTracking((current) => ({
        ...current,
        [location.ownerType]: location,
      }));
    };
    socket.on("order:location", handleLocation);

    return () => {
      socket.off("order:location", handleLocation);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [order._id, order.providerId]);

  useEffect(() => {
    if (!canShareLiveLocation(order.status) || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < 5000) return;
        lastSentAtRef.current = now;
        socketRef.current?.emit("order:location:update", {
          orderId: order._id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocationMessage(
          "Hãy cho phép truy cập vị trí để chia sẻ hành trình realtime.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [order._id, order.status]);

  if (!order.providerId || !canShareLiveLocation(order.status)) return null;

  const otherPartyLabel =
    viewerRole === "CUSTOMER" ? "provider" : "khách hàng";

  return (
    <section className="glass-card overflow-hidden rounded-3xl border border-outline-variant/30">
      <div className="flex flex-col gap-2 p-md sm:flex-row sm:items-center sm:justify-between sm:p-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">location_searching</span>
            <h2 className="font-headline-md text-on-surface">Theo dõi vị trí realtime</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Bạn và {otherPartyLabel} đều xem được vị trí hiện tại của nhau.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Trực tiếp
        </span>
      </div>
      <div ref={mapElementRef} className="h-[340px] w-full bg-surface-container-low" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 px-md py-3 text-xs text-on-surface-variant sm:px-lg">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-600" /> Khách hàng
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-600" /> Provider
          </span>
        </div>
        <span>{locationMessage}</span>
      </div>
    </section>
  );
}
