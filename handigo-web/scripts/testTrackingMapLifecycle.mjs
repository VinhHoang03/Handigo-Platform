import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Mô phỏng StrictMode: chạy effect, dọn dẹp, rồi chạy lại với cùng refs.
const effects = [];
const maps = [];
const layer = (kind) => ({
  kind,
  addTo(map) { this.map = map; map.layers.add(this); return this; },
  remove() { this.map?.layers.delete(this); return this; },
  bindPopup() { return this; },
  bindTooltip() { this.hasLabel = true; return this; },
  getPopup() { return { setContent() {} }; },
  setTooltipContent() {}, setLatLng() {}, setIcon() {},
  setLatLngs() {}, setStyle() {}, setRadius() {},
  getBounds() { return []; },
});
const leaflet = {
  map() {
    const map = { layers: new Set(), fitBounds() {}, setView() {}, remove() { this.layers.clear(); } };
    maps.push(map);
    return map;
  },
  marker: () => layer("marker"), circle: () => layer("circle"),
  polyline: () => layer("route"), tileLayer: () => layer("tiles"),
  control: {
    zoom: () => layer("zoom"),
    attribution: () => ({ addAttribution() { return layer("attribution"); } }),
  },
};
const source = readFileSync(new URL("../src/features/tracking/components/order-tracking-map/use-leaflet-map-view.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exports = {};
vm.runInNewContext(outputText, {
  exports,
  require(name) {
    if (name === "react") return { useRef: (current) => ({ current }), useEffect: (effect) => effects.push(effect) };
    if (name === "leaflet") return { __esModule: true, default: leaflet };
    if (name.endsWith(".css")) return {};
    if (name === "./constants") return { TRACKING_COLORS: { customer: "blue" } };
    if (name === "./geo-helpers") return { toLatLng: (p) => [p.latitude, p.longitude] };
    if (name === "./leaflet-marker-factory") return new Proxy({}, { get: () => () => ({}) });
    throw new Error(`Module chưa được giả lập: ${name}`);
  },
});
const coordinate = { latitude: 10.8, longitude: 106.7 };
const params = {
  searchRadiusKm: 5, hasMapCoordinate: true,
  points: [{ key: "customer", coordinate, displayText: "Địa chỉ kiểm thử" }],
  liveTrackingEnabled: false, customerCoordinate: coordinate,
  providerCoordinate: null, hasRoadRoute: false, routePath: [],
};
const container = exports.useLeafletMapView(params);
container.current = {};
const check = () => {
  const layers = [...maps.at(-1).layers];
  assert.equal(layers.filter((item) => item.kind === "circle").length, 1);
  assert.equal(layers.filter((item) => item.kind === "marker" && item.hasLabel).length, 1,
    "Bản đồ phải có ghim và nhãn địa chỉ khi đang tìm thợ");
};
const cleanups = effects.map((effect) => effect());
check();
cleanups.forEach((cleanup) => cleanup?.());
effects.forEach((effect) => effect());
check();
effects[0]();
check();
console.log("Đạt: ghim và nhãn tồn tại sau StrictMode và cập nhật bản đồ, không bị nhân đôi.");

params.points.push({ key: "candidate:1", coordinate, displayText: "Thợ phù hợp" });
effects[0]();
assert.equal([...maps.at(-1).layers].filter((item) => item.kind === "marker").length, 2);
params.points.pop();
effects[0]();
assert.equal([...maps.at(-1).layers].filter((item) => item.kind === "marker").length, 1);
console.log("Đạt: thêm thợ phù hợp và gỡ marker khi thợ không còn trong danh sách.");
