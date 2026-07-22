import L from "leaflet";
import { mapText, TRACKING_COLORS } from "./constants";
import type { TrackingPoint } from "./types";

// ─── Custom Leaflet marker HTML factory ───────────────────────────────────────

export const createCustomIcon = (shortLabel: string, color: string, pulse: boolean) => {
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
        border:3px solid ${TRACKING_COLORS.markerBorder};
        box-shadow:0 3px 12px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:700;color:${TRACKING_COLORS.markerBorder};z-index:1;
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

export const createPopupContent = (point: TrackingPoint) => {
  const container = document.createElement("div");
  container.style.minWidth = "160px";

  const title = document.createElement("p");
  title.style.cssText =
    `margin:0 0 4px;font-weight:700;font-size:13px;color:${TRACKING_COLORS.popupTitle}`;
  title.textContent = point.label;
  container.appendChild(title);

  const location = document.createElement("p");
  location.style.cssText = `margin:0;font-size:11px;color:${TRACKING_COLORS.popupBody}`;
  location.textContent = point.displayText;
  container.appendChild(location);

  if (point.updatedAtLabel !== "--") {
    const updatedAt = document.createElement("p");
    updatedAt.style.cssText =
      `margin:4px 0 0;font-size:11px;color:${TRACKING_COLORS.popupMeta}`;
    updatedAt.textContent =
      mapText.lastUpdated + ": " + point.updatedAtLabel;
    container.appendChild(updatedAt);
  }

  return container;
};

/** Inject keyframes/popup styling used by the tracking map once per document. */
export const injectTrackingMapStyles = () => {
  if (document.getElementById("leaflet-track-style")) return;
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
};
