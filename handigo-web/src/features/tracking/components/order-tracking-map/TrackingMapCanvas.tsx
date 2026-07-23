import type { RefObject } from "react";
import { mapText } from "./constants";
import type { Coordinate } from "./types";
import { Loader2, MapPinOff } from "lucide-react";

interface TrackingMapCanvasProps {
  compact: boolean;
  hasMapCoordinate: boolean;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  isGeocoding: boolean;
  locationMessage: string;
  trackingEnabled: boolean;
  providerCoordinate: Coordinate | null;
}

export function TrackingMapCanvas({
  compact,
  hasMapCoordinate,
  mapContainerRef,
  isGeocoding,
  locationMessage,
  trackingEnabled,
  providerCoordinate,
}: TrackingMapCanvasProps) {
  return (
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
          <div className="flex max-w-2xl items-center gap-4 rounded-2xl bg-surface-container-lowest/95 px-6 py-6 text-left shadow-lg ring-1 ring-outline-variant/30">
            {isGeocoding ? (
              <>
                <Loader2 aria-hidden="true" size={24} className="shrink-0 animate-spin text-primary" />
                <p className="text-sm font-semibold text-on-surface">
                  Đang xác định toạ độ địa chỉ...
                </p>
              </>
            ) : (
              <>
                <MapPinOff aria-hidden="true" size={24} className="shrink-0 text-warning" />
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
          className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-container-lowest/90 px-4 py-2 text-xs font-semibold text-on-surface shadow-md ring-1 ring-outline-variant/30 backdrop-blur-sm"
          style={{ maxWidth: "calc(100% - 32px)", textOverflow: "ellipsis", overflow: "hidden" }}
        >
          {providerCoordinate || !trackingEnabled ? locationMessage : mapText.waitingProvider}
        </div>
      )}
    </div>
  );
}
