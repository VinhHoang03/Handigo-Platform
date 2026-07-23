import { mapText } from "./constants";
import { LocateFixed, Ruler } from "lucide-react";

interface TrackingHeaderProps {
  liveTrackingEnabled: boolean;
  otherPartyLabel: string;
  addressLine: string;
  distanceLabel: string | null;
}

export function TrackingHeader({
  liveTrackingEnabled,
  otherPartyLabel,
  addressLine,
  distanceLabel,
}: TrackingHeaderProps) {
  return (
    <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <LocateFixed aria-hidden="true" size={24} className="text-primary" />
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-container px-3 py-1.5 text-xs font-bold text-on-success-container ring-1 ring-success/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            {mapText.liveBadge}
          </span>
        )}
        {distanceLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary ring-1 ring-primary/20">
            <Ruler aria-hidden="true" size={24} />
            {distanceLabel}
          </span>
        )}
      </div>
    </div>
  );
}
