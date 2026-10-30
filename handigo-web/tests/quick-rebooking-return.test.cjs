const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const tick = () => new Promise(setImmediate);
const sourceId = '507f1f77bcf86cd799439011';
const pendingId = '507f1f77bcf86cd799439012';
const service = { _id: 'service', name: 'Dọn dẹp', categoryId: 'category', isActive: true,
  serviceType: 'fixed_price', requiresOptionSelection: true };
const options = [{ _id: 'option', name: 'Dọn phòng', price: 120000, optionType: 'other', allowsQuantity: true, isActive: true }];
const addresses = [{ _id: 'address-old', fullAddress: 'Địa chỉ cũ' }, { _id: 'address-new', fullAddress: 'Địa chỉ đã chọn' }];
const source = { _id: sourceId, orderCode: 'HD-CU', status: 'completed', serviceId: service,
  addressId: addresses[0], selectedOptionIds: ['option'], selectedOptionsSnapshot: [], paymentMethod: 'cash' };

function runtime({ paid = false, recoveryFails = false, sourceFails = false, userId = 'customer', paused, restoreOnly = true,
  pathname = '/customer/bookings', returnPath } = {}) {
  let state = { categoryId: 'category', serviceId: service._id, selectedOptionIds: ['option'], selectedOptionQuantities: { option: 5 },
    uniformQuantity: 1, addressId: 'address-new', paymentMethod: 'bank', orderType: 'scheduled',
    scheduledAt: '2099-01-01T14:30', preferredProviderId: 'provider-new', preferredProviderName: 'Thợ đã chọn',
    problemDescription: 'Nhu cầu đã chỉnh sửa', voucherCode: 'GIAM20', rebookSource: { orderId: sourceId, orderCode: 'HD-CU', notices: [] },
    reset() { state = { ...state, rebookSource: undefined }; } };
  const auth = { user: { id: userId }, sessionRevision: 0 };
  const saved = new Map([
    ['quickRebookingReturn', JSON.stringify({ orderId: sourceId, userId: 'customer', returnPath })],
    ['pendingBookingOrderId', pendingId], ['bookingCreateAttempt', 'attempt'],
  ]);
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const calls = [], timers = new Map(), listeners = new Map(), slots = [];
  let cursor = 0, effects = [], timerId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  const navigate = (...args) => calls.push(['navigate', ...args]);
  const useAuthStore = Object.assign(selector => selector(auth), { getState: () => auth });
  const modules = {
    react, 'react-router-dom': { useNavigate: () => navigate },
    'lucide-react': { RotateCcw: 'icon' }, '@/components/common/Modal': { Modal: 'modal' },
    './QuickRebookingPanel': { QuickRebookingPanel: 'quick-panel' },
    '@/features/auth/store/auth.store': { useAuthStore },
    '../hooks/useBookingStore': { useBookingStore: { getState: () => state } },
    '../utils/submitQuickRebooking': { assertNoPendingRebooking() {
      if (saved.has('pendingBookingOrderId') || saved.has('bookingCreateAttempt')) throw new Error('Lần đặt chưa rõ kết quả.');
    } },
    '@/features/customer-service/api/serviceCatalog.api': { serviceCatalogApi: {
      serviceById: async () => service, options: async () => options, categories: async () => [{ _id: 'category' }],
    } },
    '../api/booking.api': { bookingApi: {
      async getOrderById(id) {
        calls.push(['read', id]);
        if (id === pendingId) {
          if (paused) await paused;
          return { _id: pendingId, paymentStatus: paid ? 'paid' : 'unpaid' };
        }
        if (sourceFails) { sourceFails = false; throw new Error('Chưa tải được dịch vụ.'); }
        return source;
      },
      async discardUnpaidOrder(id) {
        calls.push(['discard', id]);
        if (recoveryFails) throw new Error('Chưa đối soát được QR.');
      },
      getAddresses: async () => addresses,
    } },
    '@/utils/apiError': { getErrorMessage: error => error.message },
  };
  const globals = { sessionStorage: storage, window: {
    location: { pathname },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
  } };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, '../src', file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, Date, Error, Set, Map, Object, ...globals, require(name) {
      if (name in modules) return modules[name];
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`));
      return require(name);
    } }, { filename });
    return exports;
  }
  const Button = load('features/booking/components/RebookButton.tsx').RebookButton;
  return { saved, calls, auth, state: () => state,
    render() {
      cursor = 0; effects = [];
      const tree = Button({ orderId: sourceId, status: 'completed', restoreOnly });
      effects.forEach(run => run()); return tree;
    },
    timers() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(run => run()); },
    pageShow() { listeners.get('pageshow')?.({ persisted: true }); },
    helpers: load('features/booking/utils/quickRebookingReturn.ts'),
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}

test('Quay về từ PayOS tự mở form nhanh, đối soát trước và giữ đúng địa chỉ, lịch, số lượng, thợ đã chọn', async () => {
  const app = runtime(); app.render(); app.timers(); await tick();
  const panel = find(app.render(), node => node.type === 'quick-panel');
  assert.ok(panel);
  assert.equal(panel.props.prepared.restoredAfterPayment, true);
  const restored = panel.props.prepared.draft;
  assert.equal(restored.addressId, 'address-new');
  assert.equal(restored.orderType, 'scheduled');
  assert.equal(restored.scheduledAt, '2099-01-01T14:30');
  assert.equal(restored.selectedOptionQuantities.option, 5);
  assert.equal(restored.preferredProviderId, 'provider-new');
  assert.equal(restored.problemDescription, 'Nhu cầu đã chỉnh sửa');
  assert.equal(restored.voucherCode, 'GIAM20');
  assert.equal(app.calls[0][1], pendingId);
  assert.equal(app.calls[1][0], 'discard');
  assert.equal(app.saved.size, 0);
});

test('QR đã trả tiền thì mở kết quả của đơn đã trả, không mở form để tạo thêm đơn', async () => {
  const app = runtime({ paid: true }); app.render(); app.timers(); await tick();
  assert.equal(find(app.render(), node => node.type === 'quick-panel'), undefined);
  assert.equal(app.calls.some(([type]) => type === 'discard'), false);
  const result = app.calls.find(([type]) => type === 'navigate');
  assert.equal(result[1], '/customer/bookings/success');
  assert.equal(result[2].state.order._id, pendingId);
});

test('Lỗi đối soát giữ khóa và hiện thử lại, không cho xác nhận thêm đơn', async () => {
  const app = runtime({ recoveryFails: true }); app.render(); app.timers(); await tick();
  assert.ok(find(app.render(), node => node.props?.role === 'alert'));
  assert.equal(find(app.render(), node => node.type === 'quick-panel'), undefined);
  assert.equal(app.saved.get('pendingBookingOrderId'), pendingId);
});

test('Đối soát xong nhưng tải dịch vụ lỗi: thử lại vẫn giữ nháp nhanh và không đối soát trùng', async () => {
  const app = runtime({ sourceFails: true }); app.render(); app.timers(); await tick();
  const tree = app.render();
  assert.ok(app.saved.has('quickRebookingReturn'));
  find(tree, node => node.type === 'button' && node.props.children === 'Thử lại').props.onClick();
  await tick();
  assert.equal(find(app.render(), node => node.type === 'quick-panel').props.prepared.draft.selectedOptionQuantities.option, 5);
  assert.equal(app.calls.filter(([type]) => type === 'discard').length, 1);
});

test('Trang được khôi phục từ bộ nhớ trình duyệt cũng phục hồi form và đối soát', async () => {
  const app = runtime(); app.render(); app.saved.delete('quickRebookingReturn'); app.timers();
  app.saved.set('quickRebookingReturn', JSON.stringify({ orderId: sourceId, userId: 'customer' }));
  app.pageShow(); await tick();
  assert.ok(find(app.render(), node => node.type === 'quick-panel'));
  assert.equal(app.calls.some(([type]) => type === 'navigate'), false);
});

test('Nháp từ lịch sử quay lại lịch sử trước khi phục hồi form', async () => {
  const app = runtime({ restoreOnly: false }); app.render(); app.timers(); await tick();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][0], 'navigate');
  assert.equal(app.calls[0][1], `/customer/bookings?quickRebook=${sourceId}`);
  assert.equal(app.calls[0][2].replace, true);
  assert.equal(find(app.render(), node => node.type === 'quick-panel'), undefined);
});

test('Đường dẫn quay về giữ đúng nơi bắt đầu đặt và bỏ đường dẫn ngoài phạm vi', () => {
  const app = runtime();
  const makePath = app.helpers.quickRebookingReturnPath;
  assert.equal(makePath(sourceId, '/customer/bookings'), `/customer/bookings?quickRebook=${sourceId}`);
  assert.equal(makePath(sourceId, `/customer/bookings/${sourceId}`), `/customer/bookings/${sourceId}?quickRebook=${sourceId}`);
  assert.equal(makePath(sourceId, `/customer/services/${sourceId}`), `/customer/services/${sourceId}?quickRebook=${sourceId}`);
  assert.equal(makePath(sourceId, 'https://khac.example.test'), `/customer/bookings?quickRebook=${sourceId}`);
  app.saved.set('quickRebookingReturn', JSON.stringify({ orderId: sourceId, userId: 'customer', returnPath: `/customer/bookings/${sourceId}` }));
  assert.equal(makePath(sourceId), `/customer/bookings/${sourceId}?quickRebook=${sourceId}`);
});

test('Đặt lại tại chi tiết đơn phục hồi form tại chính chi tiết đơn đó', async () => {
  const app = runtime({ restoreOnly: false, pathname: `/customer/bookings/${sourceId}`,
    returnPath: `/customer/bookings/${sourceId}` });
  app.render(); app.timers(); await tick();
  assert.ok(find(app.render(), node => node.type === 'quick-panel'));
  assert.equal(app.calls.some(([type]) => type === 'navigate'), false);
});

test('Liên kết cũ về danh sách dịch vụ được chuyển về lịch sử đã bắt đầu đặt', async () => {
  const app = runtime({ pathname: '/customer/services', returnPath: '/customer/bookings' });
  app.render(); app.timers(); await tick();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][1], `/customer/bookings?quickRebook=${sourceId}`);
  assert.equal(find(app.render(), node => node.type === 'quick-panel'), undefined);
});

test('Đổi tài khoản không tự mở nháp hoặc xóa khóa của tài khoản trước', async () => {
  const app = runtime({ userId: 'customer-other' }); app.render(); app.timers(); await tick();
  assert.equal(app.calls.length, 0);
  assert.equal(app.saved.get('pendingBookingOrderId'), pendingId);
});

test('Đổi phiên lúc đang đối soát không mở form hoặc xóa khóa của phiên mới', async () => {
  let resolve;
  const app = runtime({ paused: new Promise(done => { resolve = done; }) });
  app.render(); app.timers(); app.auth.sessionRevision++; app.auth.user = { id: 'customer-other' };
  resolve(); await tick();
  assert.equal(find(app.render(), node => node.type === 'quick-panel'), undefined);
  assert.equal(app.saved.get('pendingBookingOrderId'), pendingId);
});
