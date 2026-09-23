import { mapText, TRACKING_COLORS } from "./constants";
import type { Coordinate } from "./types";

interface TrackingLegendProps {
  trackingEnabled: boolean;
  customerCoordinate: Coordinate | null;
  providerCoordinate: Coordinate | null;
}

export function TrackingLegend({
  trackingEnabled,
  customerCoordinate,
  providerCoordinate,
}: TrackingLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 px-6 py-3">
      <div className="flex flex-wrap gap-4">
        <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
          <span
            className="h-3 w-3 rounded-full ring-2 ring-surface-container-lowest shadow-sm"
            style={{ background: TRACKING_COLORS.customer }}
          />
          {mapText.addressLegend}
        </span>
        {trackingEnabled && (
          <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
            <span
              className="h-3 w-3 rounded-full ring-2 ring-surface-container-lowest shadow-sm"
              style={{ background: TRACKING_COLORS.provider }}
            />
            {mapText.providerLegend}
          </span>
        )}
        {customerCoordinate && providerCoordinate && (
          <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
            <span
              className="inline-block h-0.5 w-6 rounded-full"
              style={{
                background: `repeating-linear-gradient(90deg,${TRACKING_COLORS.customer} 0,${TRACKING_COLORS.customer} 5px,transparent 5px,transparent 9px)`,
              }}
            />
            Tuyến đường
          </span>
        )}
      </div>
    </div>
  );
}
