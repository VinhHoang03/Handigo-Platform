const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');
function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, queueMicrotask, ...globals,
    require: name => { if (name in modules) return modules[name]; throw new Error(`Chưa giả lập module: ${name}`); } });
  return exports;
}
const geo = load('features/tracking/components/order-tracking-map/geo-helpers.ts', {});
const settle = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('Địa chỉ GPS: ưu tiên điểm hiện tại, chỉ tìm gần đó khi thiếu địa chỉ, dừng khi mất kết nối hoặc yêu cầu cũ', async () => {
  const calls = [];
  let failures = 0; let status = 422;
  const { resolveProviderWorkingAddress } = load('features/provider/utils/providerWorkingArea.ts', {
    axios: { isAxiosError: error => error?.isAxiosError === true },
    '@/features/tracking/components/order-tracking-map/geo-helpers': geo,
    '@/features/booking/api/booking.api': { bookingApi: { reverseGeocode: async (latitude, longitude) => {
      calls.push({ latitude, longitude });
      if (failures-- > 0) throw { isAxiosError: true, response: { status } };
      return { fullAddress: 'Đường thử, Phường thử, Tỉnh thử', attribution: 'Nguồn bản đồ' };
    } } },
  });
  const coordinate = { latitude: 10, longitude: 106 };
  assert.equal((await resolveProviderWorkingAddress(coordinate)).nearby, false);
  failures = 1; calls.length = 0;
  const nearby = await resolveProviderWorkingAddress(coordinate);
  assert.equal(nearby.nearby, true); assert.equal(calls.length, 2);
  assert.ok(geo.haversineDistanceInMeters(coordinate, calls[1]) < 151);
  failures = 3; calls.length = 0;
  await assert.rejects(resolveProviderWorkingAddress(coordinate), /Chưa tìm được địa chỉ/);
  assert.equal(calls.length, 3, 'Giới hạn số lần tìm địa chỉ lân cận.');
  status = 503; failures = 1; calls.length = 0;
  await assert.rejects(resolveProviderWorkingAddress(coordinate));
  assert.equal(calls.length, 1, 'Không gọi dồn khi dịch vụ bản đồ gặp lỗi.');
  calls.length = 0;
  assert.equal(await resolveProviderWorkingAddress(coordinate, () => false), null);
  assert.equal(calls.length, 0);
});

test('Theo dõi GPS: đổi địa chỉ khi di chuyển, bỏ phản hồi cũ, xử lý mất quyền và dọn watcher khi rời trang', async () => {
  const slots = [], effects = [], watchers = [], requests = [], timers = new Map();
  let cursor = 0, timerId = 0;
  const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(work, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: work() };
      });
    },
  };
  const { useProviderWorkingArea } = load('features/provider/hooks/useProviderWorkingArea.ts', {
    react,
    '@/utils/apiError': { getErrorMessage: error => error.message },
    '@/features/tracking/components/order-tracking-map/geo-helpers': geo,
    '../utils/providerWorkingArea': { resolveProviderWorkingAddress: (coordinate, isCurrent) => {
      const pending = { coordinate, isCurrent, ...deferred() }; requests.push(pending); return pending.promise;
    } },
  }, {
    navigator: { geolocation: {
      watchPosition: (success, error) => { watchers.push({ success, error, cleared: false }); return watchers.length - 1; },
      clearWatch: index => { watchers[index].cleared = true; },
    } },
    window: { setTimeout: (work, delay) => { const id = ++timerId; timers.set(id, { work, delay }); return id; }, clearTimeout: id => timers.delete(id) },
  });
  const render = () => { cursor = 0; const result = useProviderWorkingArea(); effects.splice(0).forEach(work => work()); return result; };
  const emit = latitude => watchers.at(-1).success({ coords: { latitude, longitude: 106 } });
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => { void timer.work(); }); };
  assert.equal(render().loading, true);
  emit(10); render(); flush();
  requests[0].resolve({ address: 'Địa chỉ đầu', nearby: false }); await settle();
  assert.equal(render().address.address, 'Địa chỉ đầu');
  emit(10.0001); render(); assert.equal(timers.size, 0, 'Bỏ dao động GPS dưới 50 mét.');
  emit(10.001); assert.equal(render().address, undefined);
  assert.ok([...timers.values()][0].delay > 10_000, 'Giới hạn tần suất gọi bản đồ.');
  flush();
  emit(10.002); render();
  assert.equal(requests[1].isCurrent(), false);
  requests[1].resolve({ address: 'Địa chỉ cũ trả về chậm' }); await settle();
  assert.equal(render().address, undefined);
  flush(); requests[2].resolve({ address: 'Địa chỉ mới', nearby: true }); await settle();
  assert.equal(render().address.address, 'Địa chỉ mới');
  watchers.at(-1).error({ code: 1 });
  const denied = render(); assert.match(denied.error, /cho phép/); assert.equal(denied.address, undefined);
  denied.retry(); render(); assert.equal(watchers[0].cleared, true);
  emit(11); render(); flush();
  slots.forEach(slot => slot?.cleanup?.());
  assert.equal(watchers.at(-1).cleared, true); assert.equal(requests.at(-1).isCurrent(), false);
  requests.at(-1).resolve({ address: 'Phản hồi sau khi rời trang' }); await settle();
});
