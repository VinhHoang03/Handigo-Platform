const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/features/provider/hooks/useProviderAvailability.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function setup({ locationError, updateLocationError, availabilityStatus = 'offline', supported = true,
  permissionState, permissionQueryError = false, secureContext = true, policyAllowed = true,
  deactivateError = false } = {}) {
  const calls = [];
  const toasts = [];
  const state = { providerUserId: 'tho', availabilityStatus, isUpdating: false,
    setAvailabilityStatus(value) { this.availabilityStatus = value; },
    setIsUpdating(value) { this.isUpdating = value; } };
  const store = select => select(state);
  store.getState = () => state;
  const api = {
    updateCurrentLocation: async (latitude, longitude) => {
      calls.push(['location', latitude, longitude]);
      if (updateLocationError) throw typeof updateLocationError === 'object' ? updateLocationError : new Error('Không thể lưu vị trí');
    },
    deactivateCurrentLocation: async () => { calls.push(['deactivate']); if (deactivateError) throw new Error('Mất kết nối'); },
    updateAvailability: async value => { calls.push(['availability', value]); return { availabilityStatus: value }; },
  };
  const modules = {
    react: { useEffect() {}, useCallback: fn => fn },
    '../api/providerDashboard.api': { providerDashboardApi: api },
    '@/components/common/Toast': { useToast: () => ({ addToast: (message, type) => toasts.push({ message, type }) }) },
    '@/features/auth/store/auth.store': { useAuthStore: select => select({ user: { id: 'tho' } }) },
    '../store/providerAvailability.store': { useProviderAvailabilityStore: store },
  };
  const exports = {};
  const navigator = supported ? { geolocation: { getCurrentPosition(resolve, reject) {
    calls.push(['geolocation']);
    if (locationError) reject(locationError);
    else resolve({ coords: { latitude: 10, longitude: 106 } });
  } } } : {};
  if (permissionState || permissionQueryError) navigator.permissions = { query: async () => {
    if (permissionQueryError) throw new Error('Không hỗ trợ truy vấn quyền');
    return { state: permissionState };
  } };
  vm.runInNewContext(code, { exports, navigator, Error,
    window: { isSecureContext: secureContext },
    document: { permissionsPolicy: { allowsFeature: () => policyAllowed } },
    console: { warn() {} }, require: name => {
    assert.ok(name in modules, `Chưa giả lập module ${name}`);
    return modules[name];
  } });
  return { state, calls, toasts, toggle: exports.useProviderAvailability().toggleAvailability };
}

for (const [errorCode, message] of [[1, /Trình duyệt chưa lấy được vị trí/], [2, /Không xác định được vị trí/], [3, /mất quá lâu/]]) {
  test(`Lỗi vị trí mã ${errorCode}: không bật online hoặc thông báo tìm theo khu vực`, async () => {
    const runtime = setup({ locationError: { code: errorCode } });
    await runtime.toggle();
    assert.equal(runtime.state.availabilityStatus, 'offline');
    assert.equal(runtime.state.isUpdating, false);
    assert.deepEqual(runtime.calls, [['geolocation'], ['deactivate']]);
    assert.equal(runtime.toasts.length, 1);
    assert.equal(runtime.toasts[0].type, 'error');
    assert.match(runtime.toasts[0].message, message);
    assert.doesNotMatch(runtime.toasts[0].message, /theo khu vực|Đã bật/);
  });
}

test('Chỉ bật nhận việc sau khi lấy và lưu vị trí thành công', async () => {
  const runtime = setup();
  await runtime.toggle();
  assert.deepEqual(runtime.calls, [['geolocation'], ['location', 10, 106], ['availability', 'online']]);
  assert.equal(runtime.state.availabilityStatus, 'online');
  assert.equal(runtime.state.isUpdating, false);
  assert.equal(runtime.toasts[0].type, 'success');
});

test('Lưu vị trí thất bại hoặc trình duyệt không hỗ trợ thì không bật nhận việc', async () => {
  for (const options of [{ updateLocationError: true }, { supported: false }]) {
    const runtime = setup(options);
    await runtime.toggle();
    assert.equal(runtime.state.availabilityStatus, 'offline');
    assert.equal(runtime.calls.some(([name]) => name === 'availability'), false);
    assert.equal(runtime.state.isUpdating, false);
    assert.equal(runtime.toasts[0].type, 'error');
  }
});

test('Tắt nhận việc không yêu cầu quyền vị trí', async () => {
  const runtime = setup({ availabilityStatus: 'online', locationError: { code: 1 } });
  await runtime.toggle();
  assert.deepEqual(runtime.calls, [['availability', 'offline']]);
  assert.equal(runtime.state.availabilityStatus, 'offline');
  assert.equal(runtime.state.isUpdating, false);
});

test('Trang đã cho phép nhưng thiết bị từ chối: không kết luận người dùng chưa cấp quyền', async () => {
  const runtime = setup({ locationError: { code: 1, message: 'User denied Geolocation' }, permissionState: 'granted' });
  await runtime.toggle();
  assert.match(runtime.toasts[0].message, /đã được cấp quyền vị trí/);
  assert.match(runtime.toasts[0].message, /hệ điều hành/);
  assert.doesNotMatch(runtime.toasts[0].message, /Bạn chưa cho phép/);
  assert.equal(runtime.state.availabilityStatus, 'offline');
});

test('Quyền bị chặn hoặc không truy vấn được vẫn hướng dẫn đúng và kết thúc cập nhật', async () => {
  for (const options of [{ permissionState: 'denied' }, { permissionState: 'prompt' }, { permissionQueryError: true }]) {
    const runtime = setup({ locationError: { code: 1 }, ...options });
    await runtime.toggle();
    assert.doesNotMatch(runtime.toasts[0].message, /Bạn chưa cho phép/);
    assert.match(runtime.toasts[0].message, /hệ điều hành|dịch vụ vị trí của thiết bị/);
    assert.equal(runtime.state.isUpdating, false);
    assert.equal(runtime.calls.some(([name]) => name === 'availability'), false);
  }
});

test('HTTP không an toàn và chính sách trang chặn định vị có thông báo riêng', async () => {
  for (const [options, message] of [
    [{ secureContext: false }, /HTTPS hoặc localhost/],
    [{ policyAllowed: false }, /chính sách trình duyệt chặn định vị/],
  ]) {
    const runtime = setup({ locationError: { code: 1 }, ...options });
    await runtime.toggle();
    assert.match(runtime.toasts[0].message, message);
    assert.doesNotMatch(runtime.toasts[0].message, /Bạn chưa cho phép/);
  }
});

test('Server từ chối lưu vị trí không bị nhầm thành lỗi quyền định vị', async () => {
  const runtime = setup({ updateLocationError: { code: 1 } });
  await runtime.toggle();
  assert.match(runtime.toasts[0].message, /Đã lấy được vị trí nhưng chưa lưu được/);
  assert.doesNotMatch(runtime.toasts[0].message, /cấp quyền|hệ điều hành/);
  assert.equal(runtime.state.availabilityStatus, 'offline');
});

test('Lỗi dọn vị trí cũ không che mất nguyên nhân lỗi lấy vị trí', async () => {
  const runtime = setup({ locationError: { code: 1 }, permissionState: 'granted', deactivateError: true });
  await runtime.toggle();
  assert.match(runtime.toasts[0].message, /đã được cấp quyền vị trí/);
  assert.equal(runtime.state.isUpdating, false);
});
