import L from "leaflet";

/**
 * Nguồn tile: OpenStreetMap. Không dùng CARTO vì endpoint `rastertiles` hiện trả
 * ảnh "API KEY REQUIRED" với HTTP 200 nên không thể phát hiện lỗi để dự phòng.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

/** Thêm lớp bản đồ nền vào map. */
export function addBaseTileLayer(
  map: L.Map,
  options: { maxZoom?: number; maxNativeZoom?: number; withAttribution?: boolean } = {},
): L.TileLayer {
  const { withAttribution = true, ...zoomOptions } = options;
  return L.tileLayer(TILE_URL, {
    ...zoomOptions,
    attribution: withAttribution ? ATTRIBUTION : "",
  }).addTo(map);
}

/** Chuỗi ghi công hiển thị ở control attribution riêng của màn tracking. */
export const BASE_MAP_ATTRIBUTION = ATTRIBUTION;
