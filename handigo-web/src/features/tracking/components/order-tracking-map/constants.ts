// ─── i18n text ────────────────────────────────────────────────────────────────

export const mapText = {
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

// ─── Map-drawing colors ────────────────────────────────────────────────────────
// Colors handed straight to Leaflet APIs (divIcon HTML, polyline styles, popup DOM
// nodes created outside the React tree) legitimately stay hex — Leaflet doesn't
// read Tailwind classes. Centralized here so every marker/route color has one
// source of truth instead of being repeated across the file.

export const TRACKING_COLORS = {
  customer: "#4f46e5",
  customerAccent: "#818cf8",
  provider: "#059669",
  providerAccent: "#34d399",
  markerBorder: "#ffffff",
  popupTitle: "#131b2e",
  popupBody: "#6b7280",
  popupMeta: "#9ca3af",
} as const;

// ─── Tuning values ──────────────────────────────────────────────────────────────

export const ROUTE_REFRESH_INTERVAL_MS = 20_000;
export const MIN_ROUTE_REFRESH_DISTANCE_METERS = 50;
