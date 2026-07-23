import type { TrackingPoint } from "./types";

interface TrackingInfoCardsProps {
  hasMapCoordinate: boolean;
  points: TrackingPoint[];
}

export function TrackingInfoCards({ hasMapCoordinate, points }: TrackingInfoCardsProps) {
  if (!hasMapCoordinate) return null;

  return (
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
  );
}
