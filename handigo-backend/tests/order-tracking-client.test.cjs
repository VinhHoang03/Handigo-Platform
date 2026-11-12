const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(role = 'PROVIDER') {
  const effects = [], handlers = {}, sent = [];
  let clock = Date.now(), onGps, stopped = false, disposed = false;
  const socket = {
    connected: false, id: 'socket',
    on(event, handler) { handlers[event] = handler; }, off() {},
    emit(event, payload, callback) {
      sent.push({ event, payload });
      callback?.({ success: true, data: { provider: null } });
    },
  };
  const modules = {
    react: {
      useRef: current => ({ current }), useState: initial => [initial, () => {}],
      useEffect: run => effects.push(run), useCallback: callback => callback,
    },
    '@/realtime/authenticatedSocket': { createAuthenticatedSocket: () => ({ socket, dispose() { disposed = true; } }) },
    './constants': { mapText: {} }, './geo-helpers': { hasGeolocationSupport: () => true },
  };
  const filename = path.join(__dirname, '../../handigo-web/src/features/tracking/components/order-tracking-map/use-realtime-tracking.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Đồng hồ riêng không tác động đến các test khác.
  class Clock extends Date { static now() { return clock; } }
  const context = { exports: {}, Date: Clock, console: { log() {}, warn() {}, error() {} },
    navigator: { geolocation: {
      watchPosition(callback) { onGps = callback; return 1; }, clearWatch() { stopped = true; },
    } }, require: name => modules[name] };
  vm.runInNewContext(source, context, { filename });
  context.exports.useRealtimeTracking({ orderId: 'order', viewerRole: role,
    trackingEnabled: true, liveTrackingEnabled: true, savedCustomerCoordinate: null });
  const cleanup = effects.map(run => run());
  return {
    sent, socket,
    gps(age = 0) { onGps({ timestamp: clock - age, coords: { latitude: 10, longitude: 106, accuracy: 12 } }); },
    connect() { socket.connected = true; handlers.connect(); },
    advance(ms = 10000) { clock += ms; },
    cleanup() { cleanup.forEach(run => run?.()); return { stopped, disposed }; },
    hasGps() { return Boolean(onGps); },
  };
}

test('GPS đến trước socket vẫn gửi sau khi tham gia theo dõi, kèm sai số và thời gian lấy mẫu', () => {
  const s = setup(); s.gps();
  assert.equal(s.sent.length, 0);
  s.connect();
  const locations = s.sent.filter(item => item.event === 'order:location:update');
  assert.equal(locations.length, 1);
  assert.equal(locations[0].payload.accuracy, 12);
  assert.equal(typeof locations[0].payload.capturedAt, 'number');
  assert.equal(locations[0].payload.orderId, 'order');
  const cleanup = s.cleanup(); assert.equal(cleanup.stopped, true); assert.equal(cleanup.disposed, true);
});

test('Giới hạn gửi GPS 10 giây và bỏ mẫu đã cũ sau khi kết nối lại', () => {
  const s = setup(); s.connect(); s.gps(); s.gps();
  assert.equal(s.sent.filter(item => item.event === 'order:location:update').length, 1);
  s.advance(); s.gps();
  assert.equal(s.sent.filter(item => item.event === 'order:location:update').length, 2);
  s.socket.connected = false; s.advance(); s.gps();
  assert.equal(s.sent.filter(item => item.event === 'order:location:update').length, 2);
  s.advance(31000); s.connect();
  assert.equal(s.sent.filter(item => item.event === 'order:location:update').length, 2);
});

test('Khách kết nối nhận realtime mà không phải cấp quyền GPS', () => {
  const s = setup('CUSTOMER'); s.connect();
  assert.equal(s.hasGps(), false);
  assert.equal(s.sent[0].event, 'order:tracking:join');
  assert.equal(s.sent.filter(item => item.event === 'order:location:update').length, 0);
});

test('Tuyến đường và ETA tính tiếp vị trí mới nhất sau thời gian giới hạn gọi API', async () => {
  const slots = [], requests = [];
  let clock = Date.now(), cursor = 0, tick;
  const effects = [];
  const react = {
    useRef(value) { const key = cursor++; slots[key] ??= { current: value }; return slots[key]; },
    useState(initial) {
      const key = cursor++;
      if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial;
      return [slots[key], value => { slots[key] = value; }];
    },
    useEffect(run, deps) {
      const key = cursor++, previous = slots[key];
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        previous?.cleanup?.(); slots[key] = { deps };
        effects.push(() => { slots[key].cleanup = run(); });
      }
    },
  };
  const filename = path.join(__dirname, '../../handigo-web/src/features/tracking/components/order-tracking-map/use-tracking-route.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules = {
    react,
    '@/features/tracking/api/tracking.api': { trackingApi: { async getOrderRoute(orderId, origin) {
      requests.push(origin); return { durationSeconds: 600 - origin.latitude, distanceMeters: 3000, geometry: { coordinates: [] } };
    } } },
    './geo-helpers': { haversineDistanceInMeters: (a, b) => Math.abs(a.latitude - b.latitude) },
    './constants': { MIN_ROUTE_REFRESH_DISTANCE_METERS: 50, ROUTE_REFRESH_INTERVAL_MS: 20000 },
  };
  const context = { exports: {}, Date: { now: () => clock }, AbortController, console,
    window: { setInterval(callback) { tick = callback; return 1; }, clearInterval() {} },
    require: name => modules[name] };
  vm.runInNewContext(source, context, { filename });
  const customerCoordinate = { latitude: 1000, longitude: 0 };
  let providerCoordinate = { latitude: 0, longitude: 0 };
  async function render() {
    cursor = 0;
    const result = context.exports.useTrackingRoute({ orderId: 'order', liveTrackingEnabled: true,
      customerCoordinate, providerCoordinate });
    effects.splice(0).forEach(run => run());
    await Promise.resolve(); return result;
  }
  await render(); assert.equal(requests.length, 1);
  clock += 10000; providerCoordinate = { latitude: 120, longitude: 0 };
  await render(); assert.equal(requests.length, 1);
  clock += 10000; tick(); await render();
  assert.equal(requests.length, 2); assert.equal(requests[1].latitude, 120);
  assert.equal((await render()).durationSeconds, 480);
  clock += 20000; tick(); await render();
  assert.equal(requests.length, 2, 'Đứng yên không gọi tuyến đường liên tục');
});
