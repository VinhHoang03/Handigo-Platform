const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, overrides = {}, globals = {}) {
  const filename = path.isAbsolute(relative) ? relative : path.join(__dirname, '../src', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, Date, Set, Map, Object, console: { error() {} }, ...globals,
    require(name) {
      if (name in overrides) return overrides[name];
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, overrides, globals);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), overrides, globals);
      return require(name);
    },
  }, { filename });
  return exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(setImmediate);
const service = { _id: 'dich-vu', categoryId: 'danh-muc', name: 'Dọn dẹp', isActive: true, serviceType: 'fixed_price', requiresOptionSelection: true };
const option = { _id: 'tuy-chon', name: 'Dọn phòng', price: 100000, isActive: true, allowsQuantity: true };
const address = { _id: 'dia-chi', fullAddress: '12 Đường A', ward: 'Phường A', province: 'TP. Hồ Chí Minh' };
const order = { _id: 'don-cu', orderCode: 'ORD-CU', status: 'completed', serviceId: service, addressId: address,
  selectedOptionIds: [option._id], selectedOptionsSnapshot: [{ optionId: option._id, price: 100000, quantity: 2 }],
  paymentMethod: 'wallet', pricing: { bookingAmount: 200000 }, providerId: { _id: 'tho-cu', userId: { fullName: 'Nguyễn Văn An' } },
};
const { prepareRebooking } = load('features/booking/utils/rebooking.ts');
const prepared = { order, service, options: [option], addresses: [address], draft: prepareRebooking(order, service, [option], [address]), session: 1 };
const preview = { bookingAmount: 220000, discountedAmount: 210000, depositAmount: 0 };
const providers = [{ id: 'tho-cu', user: { fullName: 'Nguyễn Văn An' } }];
const draft = { ...prepared.draft, orderType: 'normal', preferredProviderId: 'tho-cu', problemDescription: 'Tình trạng mới' };

function submissionRuntime({ existing = false, session = 1, pending = false, createOrder, payment, serviceType } = {}) {
  const saved = new Map(pending ? [['bookingCreateAttempt', 'chua-ro-ket-qua']] : []);
  let state = { serviceId: existing ? 'ban-dang-soan' : undefined, recurrenceUnit: 'weekly', recurrenceCount: 1 };
  let revision = 0;
  const calls = [];
  const reset = () => { state = { recurrenceUnit: 'weekly', recurrenceCount: 1, reset }; };
  state.reset = reset;
  const sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const api = {
    createOrder: async payload => { calls.push(['order', payload]); if (createOrder) return createOrder(payload); return { _id: 'don-moi' }; },
    createPayment: async payload => { calls.push(['payment', payload]); return payment ? payment(payload) : { payment: { status: 'paid' } }; },
    getOrderById: async () => ({ _id: 'don-moi', paymentStatus: 'paid' }),
    discardUnpaidOrder: async () => { calls.push(['discard']); },
  };
  const modules = {
    '@/features/auth/store/auth.store': { useAuthStore: { getState: () => ({ sessionRevision: session }) } },
    '../hooks/useBookingStore': { useBookingStore: { getState: () => state, setState: value => { state = { ...state, ...value }; } },
      resetBookingSession: () => { calls.push(['reset']); revision++; reset(); saved.clear(); } },
    '../hooks/useBookingPreview': { invalidateBookingPreview: () => {} },
    '@/features/booking/api/booking.api': { bookingApi: api },
    '@/api/tokenStorage': { tokenStorage: { prepareExternalRedirect: () => calls.push(['redirect']) } },
    './pendingBookingRecovery': {
      PENDING_ORDER_ID_KEY: 'pendingBookingOrderId', PENDING_ORDER_FINGERPRINT_KEY: 'pendingBookingFingerprint', PENDING_ORDER_VOUCHER_KEY: 'pendingBookingVoucherCode',
      clearPendingBooking: () => saved.clear(), recoverPendingBooking: async () => ({}),
    },
    '../utils/bookingSessionStorage': { getBookingSessionRevision: () => revision },
  };
  const location = { origin: 'https://handigo.test', href: '' };
  const { submitQuickRebooking } = load('features/booking/utils/submitQuickRebooking.ts', modules, { sessionStorage, window: { location } });
  const input = { prepared: serviceType ? { ...prepared, service: { ...service, serviceType } } : prepared,
    draft, preview, providers, policyAccepted: true,
    navigate: (...args) => calls.push(['navigate', ...args]), setError: message => calls.push(['error', message]),
  };
  return { submit: changes => submitQuickRebooking({ ...input, ...changes }), calls, state: () => state, saved, location };
}

test('Xác nhận nhanh tạo và thanh toán ngay bằng luồng hiện có, giữ đúng tiền và thợ đã chọn', async () => {
  const runtime = submissionRuntime({ existing: true });
  await runtime.submit();
  const payload = runtime.calls.find(([type]) => type === 'order')[1];
  assert.equal(payload.expectedBookingAmount, 220000);
  assert.equal(payload.expectedFinalAmount, 210000);
  assert.equal(payload.preferredProviderId, 'tho-cu');
  assert.equal(payload.addressId, 'dia-chi');
  assert.equal(payload.orderType, 'normal');
  assert.equal(payload.selectedOptions[0].quantity, 2);
  assert.equal(payload.problemDescription, 'Tình trạng mới');
  assert.equal(payload.customerAttachments.length, 0);
  const payment = runtime.calls.find(([type]) => type === 'payment')[1];
  assert.equal(payment.expectedAmount, 210000);
  assert.equal(payment.method, 'WALLET');
  assert.equal(runtime.calls.find(([type]) => type === 'navigate')[1], '/customer/bookings/result');
  assert.equal(runtime.saved.size, 0);
});

test('Không đồng ý chính sách, thiếu địa chỉ, lịch hoặc thợ khả dụng đều chặn trước khi thay nháp và gọi API', async () => {
  const cases = [
    [{}, { policyAccepted: false }],
    [{ session: 2 }, {}],
    [{ pending: true }, {}],
    [{}, { providers: [] }],
    [{}, { draft: { ...draft, preferredProviderId: 'tho-khac' } }],
    [{}, { draft: { ...draft, addressId: 'dia-chi-khac' } }],
    [{}, { draft: { ...draft, selectedOptionIds: [] } }],
    [{}, { draft: { ...draft, orderType: 'scheduled', scheduledAt: '2000-01-01T10:00' } }],
    [{ serviceType: 'variable_price' }, { draft: { ...draft, paymentMethod: 'cash' } }],
  ];
  for (const [options, changes] of cases) {
    const runtime = submissionRuntime(options);
    await assert.rejects(runtime.submit(changes));
    assert.equal(runtime.calls.length, 0);
    if (options.existing) assert.equal(runtime.state().serviceId, 'ban-dang-soan');
    if (options.pending) assert.equal(runtime.saved.get('bookingCreateAttempt'), 'chua-ro-ket-qua');
  }
});

test('Đặt nhanh PayOS lưu bản nháp và dấu vết để quay lại đúng bước thanh toán', async () => {
  const runtime = submissionRuntime({ payment: async () => ({ payment: { status: 'pending' }, checkoutUrl: 'https://pay.payos.vn/thanh-toan-thu' }) });
  await runtime.submit({ draft: { ...draft, paymentMethod: 'bank', orderType: 'scheduled', scheduledAt: '2099-01-01T10:00' } });
  assert.equal(runtime.location.href, 'https://pay.payos.vn/thanh-toan-thu');
  assert.equal(runtime.saved.get('pendingBookingOrderId'), 'don-moi');
  const fingerprint = JSON.parse(runtime.saved.get('pendingBookingFingerprint'));
  assert.equal(fingerprint.serviceId, 'dich-vu');
  assert.equal(fingerprint.recurrenceUnit, 'weekly');
  assert.equal(fingerprint.scheduledAt, runtime.state().scheduledAt);
  assert.equal(runtime.calls.find(([type]) => type === 'payment')[1].method, 'PAYOS');
});

test('Giá thay đổi ở server không tạo đơn hoặc thanh toán; hiển thị lỗi để khách kiểm tra lại', async () => {
  const runtime = submissionRuntime({ createOrder: async () => { throw { response: { status: 409, data: { message: 'Giá đã thay đổi.' } } }; } });
  await runtime.submit();
  assert.equal(runtime.calls.filter(([type]) => type === 'order').length, 1);
  assert.equal(runtime.calls.some(([type]) => type === 'payment'), false);
  assert.equal(runtime.calls.filter(([type]) => type === 'error').at(-1)[1], 'Giá đã thay đổi.');
});

function hooksRuntime() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  return { react, render(work) { cursor = 0; effects = []; const result = work(); effects.forEach(run => run()); return result; } };
}

test('Đổi số lượng hoặc lịch loại bỏ giá/thợ cũ ngay; phản hồi muộn không ghi đè lựa chọn mới', async () => {
  const runtime = hooksRuntime();
  const timers = new Map();
  const requests = [];
  let timerId = 0;
  const { useQuickRebookingQuote } = load('features/booking/hooks/useQuickRebookingQuote.ts', {
    react: runtime.react,
    '../api/booking.api': { bookingApi: { preview(payload) { const pending = deferred(); requests.push({ payload, ...pending }); return pending.promise; } } },
    '@/features/customer-service/api/customerService.api': { customerServiceApi: { nearbyProviders: async () => providers } },
  }, { window: { setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } } });
  let selected = { ...draft };
  const render = () => runtime.render(() => useQuickRebookingQuote(prepared, selected));
  const runTimers = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(run => run()); };
  assert.equal(render().loading, true);
  runTimers();
  selected = { ...selected, selectedOptionQuantities: { 'tuy-chon': 3 } };
  assert.equal(render().preview, undefined);
  runTimers();
  assert.equal(requests[1].payload.selectedOptions[0].quantity, 3);
  requests[1].resolve({ ...preview, discountedAmount: 310000 }); await tick();
  assert.equal(render().preview.discountedAmount, 310000);
  requests[0].resolve(preview); await tick();
  assert.equal(render().preview.discountedAmount, 310000);
  selected = { ...selected, orderType: 'scheduled', scheduledAt: undefined };
  const invalid = render();
  assert.equal(invalid.valid, false);
  assert.equal(invalid.preview, undefined);
  assert.equal(invalid.providers.length, 0);
  selected = { ...selected, scheduledAt: '2099-01-01T10:00' };
  assert.equal(render().loading, true); runTimers();
  requests.at(-1).reject(new Error('Không tải được giá')); await tick();
  const failed = render();
  assert.equal(failed.preview, undefined);
  assert.equal(failed.error, 'Không tải được giá');
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}
const confirmButton = tree => find(tree, node => node.type === 'button' && typeof node.props.children === 'string'
  && /Xác nhận đặt|Đang xác nhận/.test(node.props.children));

function panelRuntime({ existing = false, createAddress } = {}) {
  const runtime = hooksRuntime();
  const calls = [];
  const keys = [];
  const gate = deferred();
  const storage = new Map();
  let policyAccepted = true;
  let currentDraft;
  const quote = { key: 'gia-moi', valid: true, preview, providers, loading: false, scheduleValid: true, retry: () => calls.push('refresh') };
  const store = { serviceId: existing ? 'ban-dang-soan' : undefined };
  const { QuickRebookingPanel } = load('features/booking/components/QuickRebookingPanel.tsx', {
    react: runtime.react, 'react-router-dom': { useNavigate: () => destination => calls.push(destination) },
    '@/features/auth/store/auth.store': { useAuthStore: { getState: () => ({ sessionRevision: 1, user: { id: 'khach', fullName: 'Khách hàng', phone: '0900000000' } }) } },
    '@/features/profile/components/AddressBookModal': { AddressBookModal: 'address-modal' },
    '@/features/profile/api/addressBook.api': { createUserAddress: payload => createAddress ? createAddress(payload) : Promise.resolve({ ...payload, id: 'dia-chi-moi' }) },
    '@/features/wallet/components/WalletBalanceText': { WalletBalanceText: 'balance' },
    '../hooks/useBookingStore': { useBookingStore: selector => selector(store), resetBookingSession: () => calls.push('reset') },
    '../hooks/useBookingPreview': { invalidateBookingPreview: () => {} },
    '../hooks/useQuickRebookingQuote': { useQuickRebookingQuote: (_, value) => { currentDraft = value; return quote; } },
    '../hooks/useBookingPolicies': { useBookingPolicies: key => { keys.push(key); return { accepted: policyAccepted, policies: {}, loading: false, error: '', setAccepted() {}, retry() {} }; } },
    '../utils/submitQuickRebooking': { assertNoPendingRebooking() {}, submitQuickRebooking: input => { calls.push(input); return gate.promise; } },
    './BookingPolicyConsent': { BookingPolicyConsent: 'consent' },
    './ServiceOptionsPanel': { ServiceOptionsPanel: 'options' },
    './ServiceQuantityPanel': { ServiceQuantityPanel: 'quantity' },
  }, { sessionStorage: { getItem: key => storage.get(key) ?? null } });
  return { render: () => runtime.render(() => QuickRebookingPanel({ prepared, onBusyChange: value => calls.push(value) })),
    calls, keys, quote, gate, storage, draft: () => currentDraft, setPolicy: value => { policyAccepted = value; } };
}

test('Bảng nhanh mặc định Sớm nhất, hiện giá xác nhận; bấm liên tiếp chỉ gửi một lần và giữ thông tin mới', async () => {
  const runtime = panelRuntime();
  let tree = runtime.render();
  assert.equal(runtime.draft().orderType, 'normal');
  assert.equal(runtime.draft().preferredProviderId, undefined);
  assert.match(confirmButton(tree).props.children, /210/);
  const initialConsent = runtime.keys.at(-1);
  find(tree, node => node.type === 'select' && node.props['aria-label'] === 'Thợ thực hiện').props.onChange({ target: { value: 'tho-cu' } });
  tree = runtime.render();
  assert.notEqual(runtime.keys.at(-1), initialConsent);
  assert.equal(runtime.draft().preferredProviderName, 'Nguyễn Văn An');
  const confirm = confirmButton(tree);
  confirm.props.onClick(); confirm.props.onClick();
  assert.equal(runtime.calls.filter(value => typeof value === 'object').length, 1);
  tree = runtime.render();
  assert.equal(confirmButton(tree).props.disabled, true);
  runtime.storage.set('pendingBookingOrderId', 'don-moi');
  runtime.gate.resolve(); await tick();
  tree = runtime.render();
  assert.equal(confirmButton(tree), undefined);
  const recover = find(tree, node => node.type === 'button' && node.props.children === 'Kiểm tra lần đặt vừa xác nhận');
  recover.props.onClick();
  assert.equal(runtime.calls.at(-1), '/customer/bookings/new/payment');
});

test('Bảng nhanh cho phép đặt khi có nháp, vẫn chặn khi giá/thợ chưa tải hoặc chưa đồng ý chính sách', () => {
  const runtime = panelRuntime({ existing: true });
  const tree = runtime.render();
  assert.equal(confirmButton(tree).props.disabled, false);
  assert.equal(find(tree, node => node.type === 'input' && node.props.type === 'checkbox'), undefined);
  runtime.quote.loading = true;
  assert.equal(confirmButton(runtime.render()).props.disabled, true);
  runtime.quote.loading = false; runtime.quote.providers = [];
  assert.equal(confirmButton(runtime.render()).props.disabled, true);
  runtime.quote.providers = providers; runtime.setPolicy(false);
  assert.equal(confirmButton(runtime.render()).props.disabled, true);
  assert.equal(runtime.calls.length, 0);
});

test('Thêm địa chỉ ngay trong đặt lại, lưu xong tự chọn và gửi được địa chỉ mới khi xác nhận', async () => {
  const runtime = panelRuntime();
  let tree = runtime.render();
  const initialConsent = runtime.keys.at(-1);
  find(tree, node => node.type === 'button' && node.props.children === '+ Thêm địa chỉ mới').props.onClick();
  tree = runtime.render();
  let editor = find(tree, node => node.type === 'address-modal');
  assert.equal(editor.props.addressCount, 1);
  assert.equal(editor.props.defaultRecipient.name, 'Khách hàng');
  assert.equal(confirmButton(tree).props.disabled, true);
  await editor.props.onSubmit({ recipientName: 'Người nhận mới', recipientPhone: '0900000001', fullAddress: '99 Đường B', ward: 'Phường B', province: 'TP. Hồ Chí Minh', isDefault: true });
  tree = runtime.render();
  editor = find(tree, node => node.type === 'address-modal');
  editor.props.onClose();
  tree = runtime.render();
  assert.equal(find(tree, node => node.type === 'address-modal'), undefined);
  assert.equal(runtime.draft().addressId, 'dia-chi-moi');
  assert.notEqual(runtime.keys.at(-1), initialConsent);
  const addressSelect = find(tree, node => node.type === 'select' && node.props['aria-label'] === 'Địa chỉ thực hiện');
  assert.equal(addressSelect.props.value, 'dia-chi-moi');
  assert.ok(find(addressSelect, node => node.type === 'option' && node.props.value === 'dia-chi-moi'));
  confirmButton(tree).props.onClick();
  const submission = runtime.calls.find(value => value && typeof value === 'object' && value.prepared);
  assert.ok(submission.prepared.addresses.some(item => item._id === 'dia-chi-moi'));
  assert.equal(submission.prepared.addresses.find(item => item._id === address._id).isDefault, false);
  assert.equal(submission.draft.addressId, 'dia-chi-moi');
  runtime.gate.resolve(); await tick();
});

test('Lưu địa chỉ lỗi giữ form để sửa; bấm lưu lặp không tạo hai địa chỉ', async () => {
  const pending = deferred();
  let creates = 0;
  const runtime = panelRuntime({ createAddress: () => { creates++; return pending.promise; } });
  let tree = runtime.render();
  find(tree, node => node.type === 'button' && node.props.children === '+ Thêm địa chỉ mới').props.onClick();
  tree = runtime.render();
  const editor = find(tree, node => node.type === 'address-modal');
  const saving = editor.props.onSubmit({ fullAddress: 'Địa chỉ thử' });
  await editor.props.onSubmit({ fullAddress: 'Địa chỉ thử' });
  find(runtime.render(), node => node.type === 'address-modal').props.onClose();
  assert.ok(find(runtime.render(), node => node.type === 'address-modal'));
  assert.equal(creates, 1);
  pending.reject(new Error('Không lưu được địa chỉ'));
  await assert.rejects(saving, /Không lưu được địa chỉ/);
  tree = runtime.render();
  assert.ok(find(tree, node => node.type === 'address-modal'));
  assert.equal(runtime.draft().addressId, address._id);
  assert.equal(find(tree, node => node.type === 'address-modal').props.isSaving, false);
});
