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

/** Ghim địa chỉ đặt dịch vụ có đầu nhọn trỏ đúng tâm tìm kiếm. */
export const createServiceAddressIcon = () => L.divIcon({
  className: "service-address-marker",
  html: `<svg width="48" height="60" viewBox="0 0 48 60" aria-hidden="true" style="filter:drop-shadow(0 3px 4px #0005)">
    <path d="M24 58C19 49 3 35 3 24a21 21 0 1 1 42 0c0 11-16 25-21 34Z" fill="${TRACKING_COLORS.customer}" stroke="white" stroke-width="3"/>
    <path d="m13 24 11-9 11 9M16 22v13h16V22M21 35v-9h6v9" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  iconSize: [48, 60],
  iconAnchor: [24, 58],
  popupAnchor: [0, -58],
});

/** Dùng textContent để địa chỉ do khách nhập không được diễn giải thành HTML. */
export const createServiceAddressLabel = (address: string) => {
  const container = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Địa chỉ đặt dịch vụ";
  const detail = document.createElement("div");
  detail.textContent = address;
  container.append(title, detail);
  return container;
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
    .leaflet-tooltip.service-address-label {
      width: max-content;
      max-width: min(240px, 65vw);
      white-space: normal;
      text-align: center;
      padding: 8px 12px;
      border: 2px solid ${TRACKING_COLORS.customer};
      border-radius: 10px;
      color: ${TRACKING_COLORS.popupTitle};
      background: white;
      box-shadow: 0 3px 12px #0003;
    }
    .service-address-label strong { display: block; font-size: 13px; }
    .service-address-label div {
      font-size: 12px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
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

/** Mũ bảo hộ và áo kỹ thuật viên, phân biệt với ghim nhà của khách. */
export const createTechnicianIcon = (assigned: boolean) => L.divIcon({
  className: "technician-marker",
  html: `<div style="width:44px;height:44px;border-radius:50%;background:${assigned ? "#047857" : "#0f766e"};border:3px solid white;box-shadow:0 3px 10px #0004;position:relative">
    ${assigned ? '<span style="position:absolute;inset:-6px;border:2px solid #10b981;border-radius:50%;animation:trackPulse 2s infinite"></span>' : ""}
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
      <path d="M8 35v-5c0-5 5-8 12-8s12 3 12 8v5" fill="#e0f2f1"/>
      <path d="m15 25 5 5 5-5M20 30v5" fill="none" stroke="#0f766e" stroke-width="2"/>
      <circle cx="20" cy="17" r="7" fill="#ffdbb5"/>
      <path d="M10 15a10 10 0 0 1 20 0Z" fill="#fbbf24"/>
      <path d="M20 4v9M8 15h24" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/>
    </svg></div>`,
  iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
});
