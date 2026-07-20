import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

interface LocationPickerMapProps {
  latitude?: number;
  longitude?: number;
  disabled?: boolean;
  isResolvingAddress?: boolean;
  onPositionChange: (latitude: number, longitude: number) => void;
}

const DEFAULT_CENTER: L.LatLngExpression = [16.0471, 108.2068];

const isValidCoordinate = (latitude?: number, longitude?: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude! >= -90 &&
  latitude! <= 90 &&
  longitude! >= -180 &&
  longitude! <= 180;

export function LocationPickerMap({
  latitude,
  longitude,
  disabled = false,
  isResolvingAddress = false,
  onPositionChange,
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lastCenterRef = useRef<L.LatLng | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  const initialCoordinateRef = useRef({ latitude, longitude });

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const initialCoordinate = initialCoordinateRef.current;
    const hasInitialCoordinate = isValidCoordinate(
      initialCoordinate.latitude,
      initialCoordinate.longitude,
    );
    const map = L.map(containerRef.current, {
      center: hasInitialCoordinate
        ? [initialCoordinate.latitude!, initialCoordinate.longitude!]
        : DEFAULT_CENTER,
      zoom: hasInitialCoordinate ? 17 : 5,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    lastCenterRef.current = map.getCenter();

    const handleMoveEnd = () => {
      const center = map.getCenter();
      const lastCenter = lastCenterRef.current;
      if (lastCenter && center.distanceTo(lastCenter) < 0.05) return;

      lastCenterRef.current = center;
      onPositionChangeRef.current(center.lat, center.lng);
    };

    map.on("moveend", handleMoveEnd);
    mapRef.current = map;

    const frame = window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.cancelAnimationFrame(frame);
      map.off("moveend", handleMoveEnd);
      map.remove();
      mapRef.current = null;
      lastCenterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isValidCoordinate(latitude, longitude)) return;

    const center = map.getCenter();
    if (
      Math.abs(center.lat - latitude!) < 0.000001 &&
      Math.abs(center.lng - longitude!) < 0.000001
    ) {
      return;
    }

    lastCenterRef.current = L.latLng(latitude!, longitude!);
    map.setView([latitude!, longitude!], Math.max(map.getZoom(), 17), {
      animate: true,
    });
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (disabled) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.keyboard.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.keyboard.enable();
    }
  }, [disabled]);

  const hasCoordinate = isValidCoordinate(latitude, longitude);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold text-on-surface">
            Chọn vị trí chính xác trên bản đồ
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Kéo bản đồ để đưa vị trí cần chọn vào đúng ghim ở giữa.
          </p>
        </div>
        <span
          aria-live="polite"
          className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
        >
          {isResolvingAddress
            ? "Đang xác định địa chỉ..."
            : hasCoordinate
              ? "Đã ghim vị trí"
              : "Chưa ghim vị trí"}
        </span>
      </div>

      <div className="relative select-none overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-low shadow-sm">
        <div
          ref={containerRef}
          role="application"
          aria-label="Bản đồ chọn vị trí. Kéo bản đồ để thay đổi vị trí dưới ghim ở giữa."
          className="h-64 w-full sm:h-72"
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full drop-shadow-[0_3px_3px_rgba(0,0,0,0.35)]">
          <MapPin
            size={42}
            className="fill-primary text-on-primary"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[499] h-3 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-surface/20 blur-[2px]" />
        {disabled && (
          <div className="absolute inset-0 z-[600] grid place-items-center bg-surface/35 backdrop-blur-[1px]">
            <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface shadow-md">
              Đang xử lý vị trí...
            </span>
          </div>
        )}
      </div>

      {hasCoordinate && (
        <p className="px-1 text-[11px] text-on-surface-variant">
          Tọa độ đã chọn: {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
        </p>
      )}
    </div>
  );
}
