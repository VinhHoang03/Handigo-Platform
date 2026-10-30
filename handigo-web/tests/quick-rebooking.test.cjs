const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Cố định thời gian trong giờ đặt ngay để kiểm thử không phụ thuộc giờ chạy.
class BookingDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-29T03:00:00.000Z'])); }
  static now() { return new Date('2026-10-29T03:00:00.000Z').getTime(); }
}

function load(relative, overrides = {}, globals = {}) {
  const filename = path.isAbsolute(relative) ? relative : path.join(__dirname, '../src', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, Date: BookingDate, Set, Map, Object, console: { error() {} }, ...globals,
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
const voucher = { id: 'ma-giam-gia', code: 'GIAM20', discountType: 'AMOUNT', discountValue: 20000 };
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
    '@/features/auth/store/auth.store': { useAuthStore: { getState: () => ({ sessionRevision: session, user: { id: 'khach' } }) } },
    '../hooks/useBookingStore': { useBookingStore: { getState: () => state, setState: value => { state = { ...state, ...value }; } },
      resetBookingSession: () => { calls.push(['reset']); revision++; reset(); saved.clear(); } },
    '../hooks/useBookingPreview': { invalidateBookingPreview: () => {} },
    '@/features/booking/api/booking.api': { bookingApi: api },
    '@/api/tokenStorage': { tokenStorage: { prepareExternalRedirect: () => calls.push(['redirect']) } },
    './pendingBookingRecovery': {
      PENDING_ORDER_ID_KEY: 'pendingBookingOrderId', PENDING_ORDER_FINGERPRINT_KEY: 'pendingBookingFingerprint', PENDING_ORDER_VOUCHER_KEY: 'pendingBookingVoucherCode',
      clearPendingBooking: () => saved.clear(), recoverPendingBooking: async () => ({}),
    },
    '../utils/bookingSessionStorage': { getBookingSessionRevision: () => revision, QUICK_REBOOKING_RETURN_KEY: 'quickRebookingReturn' },
  };
  const location = { origin: 'https://handigo.test', href: '' };
  const { submitQuickRebooking } = load('features/booking/utils/submitQuickRebooking.ts', modules, { sessionStorage,
    window: { location, history: { state: {}, replaceState: (_, __, path) => calls.push(['return-path', path]) } } });
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
    [{}, { draft: { ...draft, voucherCode: voucher.code } }],
    [{}, { draft: { ...draft, voucherCode: 'MAKHAC' }, appliedVoucher: voucher }],
  ];
  for (const [options, changes] of cases) {
    const runtime = submissionRuntime(options);
    await assert.rejects(runtime.submit(changes));
    assert.equal(runtime.calls.length, 0);
    if (options.existing) assert.equal(runtime.state().serviceId, 'ban-dang-soan');
    if (options.pending) assert.equal(runtime.saved.get('bookingCreateAttempt'), 'chua-ro-ket-qua');
  }
});

test('Đặt lại gửi mã đã áp dụng và số tiền server xác nhận cho cả ba phương thức thanh toán', async () => {
  for (const paymentMethod of ['wallet', 'bank', 'cash']) {
    const runtime = submissionRuntime();
    await runtime.submit({ draft: { ...draft, paymentMethod, voucherCode: voucher.code }, appliedVoucher: voucher,
      preview: { ...preview, discountedAmount: 190000, voucherDiscountAmount: 20000 } });
    const payload = runtime.calls.find(([type]) => type === 'order')[1];
    assert.equal(payload.voucherCode, voucher.code);
    assert.equal(payload.expectedFinalAmount, 190000);
    assert.equal(runtime.calls.find(([type]) => type === 'payment')[1].expectedAmount, 190000);
  }
});

test('Đặt nhanh PayOS lưu nháp, chủ sở hữu và địa chỉ quay về form đặt lại nhanh', async () => {
  const runtime = submissionRuntime({ payment: async () => ({ payment: { status: 'pending' }, checkoutUrl: 'https://pay.payos.vn/thanh-toan-thu' }) });
  await runtime.submit({ draft: { ...draft, paymentMethod: 'bank', orderType: 'scheduled', scheduledAt: '2099-01-01T10:00', voucherCode: voucher.code }, appliedVoucher: voucher });
  assert.equal(runtime.location.href, 'https://pay.payos.vn/thanh-toan-thu');
  assert.equal(runtime.saved.get('pendingBookingOrderId'), 'don-moi');
  assert.equal(runtime.saved.get('pendingBookingVoucherCode'), voucher.code);
  assert.equal(runtime.state().voucherCode, voucher.code);
  const fingerprint = JSON.parse(runtime.saved.get('pendingBookingFingerprint'));
  assert.equal(fingerprint.serviceId, 'dich-vu');
  assert.equal(fingerprint.recurrenceUnit, 'weekly');
  assert.equal(fingerprint.scheduledAt, runtime.state().scheduledAt);
  assert.equal(runtime.calls.find(([type]) => type === 'payment')[1].method, 'PAYOS');
  assert.equal(runtime.calls.find(([type]) => type === 'payment')[1].cancelUrl,
    'https://handigo.test/customer/bookings?quickRebook=don-cu');
  assert.equal(JSON.parse(runtime.saved.get('quickRebookingReturn')).orderId, 'don-cu');
  assert.equal(JSON.parse(runtime.saved.get('quickRebookingReturn')).userId, 'khach');
  assert.equal(runtime.calls.find(([type]) => type === 'return-path')[1], '/customer/bookings?quickRebook=don-cu');
});

test('Giờ hẹn đặt lại nhanh chỉ nhận từ 08:00 đến 21:00 và chặn trước khi thay nháp hoặc gọi API', async () => {
  for (const time of ['00:00', '07:59', '21:01', '23:59']) {
    const runtime = submissionRuntime();
    await assert.rejects(runtime.submit({ draft: { ...draft, orderType: 'scheduled', scheduledAt: `2099-01-01T${time}` } }), /08:00 đến 21:00/);
    assert.equal(runtime.calls.length, 0);
  }
  for (const time of ['08:00', '12:30', '20:59', '21:00']) {
    const runtime = submissionRuntime();
    await runtime.submit({ draft: { ...draft, orderType: 'scheduled', scheduledAt: `2099-01-01T${time}` } });
    assert.equal(runtime.calls.some(([type]) => type === 'order'), true);
  }
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
  for (const time of ['07:59', '21:01', '23:59']) {
    selected = { ...selected, scheduledAt: `2099-01-01T${time}` };
    const outsideHours = render();
    assert.equal(outsideHours.valid, false);
    assert.equal(outsideHours.scheduleValid, false);
    assert.equal(outsideHours.preview, undefined);
    assert.equal(outsideHours.providers.length, 0);
    assert.equal(timers.size, 0);
  }
  for (const time of ['08:00', '21:00']) {
    selected = { ...selected, scheduledAt: `2099-01-01T${time}` };
    assert.equal(render().scheduleValid, true);
  }
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

test('Đổi hoặc gỡ mã lấy lại giá server; phản hồi mã cũ và mã không đủ điều kiện không thể dùng để đặt', async () => {
  const runtime = hooksRuntime();
  const timers = new Map(), requests = [];
  let timerId = 0;
  const { useQuickRebookingQuote } = load('features/booking/hooks/useQuickRebookingQuote.ts', {
    react: runtime.react,
    '../api/booking.api': { bookingApi: { preview(payload) {
      const pending = deferred(); requests.push({ payload, ...pending }); return pending.promise;
    } } },
    '@/features/customer-service/api/customerService.api': { customerServiceApi: { nearbyProviders: async () => providers } },
  }, { window: { setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } } });
  let selected = { ...draft };
  const render = () => runtime.render(() => useQuickRebookingQuote(prepared, selected));
  const runTimers = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(run => run()); };
  render(); runTimers();
  selected = { ...selected, voucherCode: voucher.code };
  assert.equal(render().preview, undefined); runTimers();
  assert.equal(requests[1].payload.voucherCode, voucher.code);
  selected = { ...selected, voucherCode: undefined };
  assert.equal(render().loading, true); runTimers();
  requests[2].resolve(preview); await tick();
  requests[1].resolve({ ...preview, discountedAmount: 190000 }); await tick();
  requests[0].resolve({ ...preview, discountedAmount: 200000 }); await tick();
  assert.equal(render().preview.discountedAmount, 210000);
  selected = { ...selected, voucherCode: voucher.code, selectedOptionQuantities: { 'tuy-chon': 1 } };
  render(); runTimers();
  requests[3].reject({ response: { data: { message: 'Đơn chưa đạt mức tối thiểu áp dụng mã.' } } }); await tick();
  assert.equal(render().preview, undefined);
  assert.match(render().error, /tối thiểu/);
  selected = { ...selected, voucherCode: undefined };
  render(); runTimers(); requests[4].resolve(preview); await tick();
  assert.equal(render().preview.discountedAmount, 210000);
});

test('Mã được tải theo loại dịch vụ, phục hồi sau QR và thử lại khi tải lỗi; bước thường vẫn kiểm tra giá trị tối thiểu', async () => {
  const runtime = hooksRuntime();
  const timers = new Map(), requests = [];
  let timerId = 0;
  const { useConfirmPaymentVoucher } = load('features/booking/components/useConfirmPaymentVoucher.ts', {
    react: runtime.react,
    '@/components/common/Toast': { useToastFeedback(initial) {
      const [value, setValue] = runtime.react.useState(initial);
      const setter = runtime.react.useRef(setValue);
      return [value, setter.current];
    } },
    '@/features/booking/api/voucher.api': { bookingVoucherApi: { available() {
      const pending = deferred(); requests.push(pending); return pending.promise;
    } } },
  }, { window: { setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } } });
  let amount;
  const render = () => runtime.render(() => useConfirmPaymentVoucher(amount, false, true, voucher.code));
  const runTimers = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(run => run()); };
  assert.equal(render().loading, true); runTimers();
  requests[0].reject(new Error('Mất kết nối')); await tick();
  assert.match(render().loadError, /Không thể tải/);
  render().retry(); render(); runTimers();
  const available = [{ ...voucher, applicableOrderType: 'fixed_price', minOrderAmount: 100000 },
    { ...voucher, id: 'ma-khao-sat', code: 'KHAMSUA', applicableOrderType: 'variable_price' }];
  requests[1].resolve(available); await tick();
  let state = render();
  assert.equal(state.loading, false);
  assert.equal(state.loadError, '');
  assert.equal(state.availableVouchers.length, 1);
  assert.equal(state.appliedVoucher.code, voucher.code);
  amount = 50000;
  render(); runTimers(); requests[2].resolve(available); await tick();
  state = render();
  assert.equal(state.appliedVoucher, null);
  state.applyVoucherCode(voucher.code);
  assert.match(render().voucherError, /tối thiểu/);
});
const confirmButton = tree => find(tree, node => node.type === 'button' && typeof node.props.children === 'string'
  && /Xác nhận đặt|Đang xác nhận/.test(node.props.children));

function panelRuntime({ existing = false, createAddress, restoredDraft } = {}) {
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
    '@/components/common/Modal': { Modal: 'schedule-modal' },
    '@/components/common/Toast': { useToast: () => ({ addToast: (message, type) => calls.push(['toast', message, type]) }) },
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
    './ConfirmPaymentVoucherPanel': { ConfirmPaymentVoucherPanel: 'voucher-panel' },
    './useConfirmPaymentVoucher': { useConfirmPaymentVoucher: (_, __, ___, initialCode) => {
      const [voucherCode, setVoucherCode] = runtime.react.useState(initialCode);
      const [appliedVoucher, setAppliedVoucher] = runtime.react.useState(initialCode === voucher.code ? voucher : null);
      const [voucherError, setVoucherError] = runtime.react.useState('');
      return { availableVouchers: [voucher], voucherCode, setVoucherCode, appliedVoucher, setAppliedVoucher,
        voucherError, setVoucherError, loading: false, loadError: '', retry() {},
        applyVoucherCode(code) {
          setAppliedVoucher(code.toUpperCase() === voucher.code ? voucher : null);
          setVoucherError(code && code.toUpperCase() !== voucher.code ? 'Mã không khả dụng.' : '');
        } };
    } },
    './ServiceOptionsPanel': { ServiceOptionsPanel: 'options' },
    './ServiceQuantityPanel': { ServiceQuantityPanel: 'quantity' },
    './QuickRebookingSchedulePicker': { QuickRebookingSchedulePicker: 'schedule-picker' },
    './QuickRebookingProviderPicker': { QuickRebookingProviderPicker: 'provider-picker' },
  }, { sessionStorage: { getItem: key => storage.get(key) ?? null } });
  const panelPrepared = restoredDraft ? { ...prepared, draft: restoredDraft, restoredAfterPayment: true } : prepared;
  return { render: () => runtime.render(() => QuickRebookingPanel({ prepared: panelPrepared, onBusyChange: value => calls.push(value) })),
    calls, keys, quote, gate, storage, draft: () => currentDraft, setPolicy: value => { policyAccepted = value; } };
}

test('Form đặt lại chọn, nhập, áp dụng và gỡ mã; mã chưa áp dụng không được xác nhận', async () => {
  const runtime = panelRuntime();
  let tree = runtime.render();
  const initialConsent = runtime.keys.at(-1);
  let panel = find(tree, node => node.type === 'voucher-panel');
  panel.props.onManualInputChange('KHONGHOPLE');
  tree = runtime.render();
  assert.equal(confirmButton(tree).props.disabled, true);
  panel = find(tree, node => node.type === 'voucher-panel');
  assert.equal(panel.props.manualInputValue, 'KHONGHOPLE');
  panel.props.onApplyClick();
  assert.ok(find(runtime.render(), node => node.type === 'voucher-panel').props.voucherError);
  panel.props.onSelectVoucher(voucher.code);
  tree = runtime.render();
  assert.equal(runtime.draft().voucherCode, voucher.code);
  assert.notEqual(runtime.keys.at(-1), initialConsent);
  assert.equal(confirmButton(tree).props.disabled, false);
  panel = find(tree, node => node.type === 'voucher-panel');
  assert.equal(panel.props.appliedVoucher.code, voucher.code);
  assert.equal(panel.props.manualInputValue, '');
  panel.props.onRemoveVoucher();
  tree = runtime.render();
  assert.equal(runtime.draft().voucherCode, undefined);
  assert.equal(find(tree, node => node.type === 'voucher-panel').props.appliedVoucher, null);
  find(tree, node => node.type === 'voucher-panel').props.onSelectVoucher(voucher.code);
  tree = runtime.render();
  confirmButton(tree).props.onClick();
  const submission = runtime.calls.find(value => value && typeof value === 'object' && value.prepared);
  assert.equal(submission.draft.voucherCode, voucher.code);
  assert.equal(submission.appliedVoucher.code, voucher.code);
  runtime.gate.resolve(); await tick();
});

test('Chọn voucher giữ ô nhập trống; toast thành công xuất hiện một lần sau khi server xác nhận giá', () => {
  const runtime = panelRuntime();
  let panel = find(runtime.render(), node => node.type === 'voucher-panel');
  assert.equal(panel.props.manualInputValue, '');
  runtime.quote.loading = true;
  runtime.quote.preview = undefined;
  panel.props.onSelectVoucher(voucher.code);
  runtime.render();
  assert.equal(runtime.calls.filter(value => value?.[0] === 'toast').length, 0);
  runtime.quote.loading = false;
  runtime.quote.error = 'Mã chưa đủ điều kiện.';
  runtime.render();
  assert.equal(runtime.calls.filter(value => value?.[0] === 'toast').length, 0);
  runtime.quote.error = undefined;
  runtime.quote.preview = { ...preview, discountedAmount: 190000, voucherDiscountAmount: 20000 };
  runtime.render(); runtime.render();
  const toasts = runtime.calls.filter(value => value?.[0] === 'toast');
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0][1], 'Áp dụng mã giảm giá thành công.');
  assert.equal(toasts[0][2], 'success');
  panel = find(runtime.render(), node => node.type === 'voucher-panel');
  panel.props.onSelectVoucher(''); runtime.render();
  assert.equal(runtime.draft().voucherCode, undefined);
  assert.equal(runtime.calls.filter(value => value?.[0] === 'toast').length, 1);
});

test('Bộ chọn voucher giữ ô nhập thủ công độc lập với mã đang chọn', () => {
  const { ConfirmPaymentVoucherPanel } = load('features/booking/components/ConfirmPaymentVoucherPanel.tsx');
  const props = { voucherCode: voucher.code, availableVouchers: [voucher], appliedVoucher: voucher,
    voucherDiscountAmount: 12000,
    voucherError: '', isSubmitting: false, onSelectVoucher() {}, onManualInputChange() {}, onApplyClick() {}, onRemoveVoucher() {} };
  const quick = ConfirmPaymentVoucherPanel({ ...props, manualInputValue: '', showAppliedVoucherNotice: false });
  assert.equal(find(quick, node => node.type === 'select').props.value, voucher.code);
  assert.equal(find(quick, node => node.type === 'input').props.value, '');
  assert.equal(find(quick, node => node.type === 'button').props.children, 'Gỡ mã');
  const standard = ConfirmPaymentVoucherPanel(props);
  assert.equal(find(standard, node => node.type === 'input'), undefined);
  assert.ok(find(standard, node => node.type === 'span' && node.props.children.join('') === 'Giảm 12.000đ'));
  assert.equal(find(standard, node => node.type === 'button').props.onClick, props.onRemoveVoucher);
  assert.ok(find(ConfirmPaymentVoucherPanel({ ...props, appliedVoucher: null }), node => node.type === 'input'));
});

test('Nhập mã thủ công vẫn áp dụng được và hiện toast sau khi lấy giá thành công', () => {
  const runtime = panelRuntime();
  let panel = find(runtime.render(), node => node.type === 'voucher-panel');
  panel.props.onManualInputChange(voucher.code);
  panel = find(runtime.render(), node => node.type === 'voucher-panel');
  assert.equal(panel.props.manualInputValue, voucher.code);
  assert.equal(confirmButton(runtime.render()).props.disabled, true);
  runtime.quote.loading = true;
  runtime.quote.preview = undefined;
  panel.props.onApplyClick();
  runtime.render();
  assert.equal(runtime.draft().voucherCode, voucher.code);
  assert.equal(runtime.calls.filter(value => value?.[0] === 'toast').length, 0);
  runtime.quote.loading = false;
  runtime.quote.preview = { ...preview, discountedAmount: 190000 };
  runtime.render();
  assert.equal(runtime.calls.filter(value => value?.[0] === 'toast').length, 1);
  panel = find(runtime.render(), node => node.type === 'voucher-panel');
  panel.props.onSelectVoucher(voucher.code);
  assert.equal(find(runtime.render(), node => node.type === 'voucher-panel').props.manualInputValue, '');
});

test('Form được phục hồi sau QR giữ lịch đã chọn, không đổi sang Sớm nhất', () => {
  const restoredDraft = { ...draft, orderType: 'scheduled', scheduledAt: '2099-01-01T14:30',
    paymentMethod: 'bank', selectedOptionQuantities: { 'tuy-chon': 5 } };
  const runtime = panelRuntime({ restoredDraft });
  const tree = runtime.render();
  assert.equal(runtime.draft().orderType, 'scheduled');
  assert.equal(runtime.draft().scheduledAt, restoredDraft.scheduledAt);
  assert.equal(runtime.draft().selectedOptionQuantities['tuy-chon'], 5);
  assert.equal(find(tree, node => node.type === 'schedule-picker'), undefined);
  find(tree, node => node.type === 'button' && node.props.children === 'Chọn giờ').props.onClick();
  assert.equal(find(runtime.render(), node => node.type === 'schedule-picker').props.value, restoredDraft.scheduledAt);
});

test('Form chọn ngày giờ chỉ áp dụng sau xác nhận; hủy giữ nguyên giờ hẹn', () => {
  const original = '2099-01-01T14:30';
  const runtime = panelRuntime({ restoredDraft: { ...draft, orderType: 'scheduled', scheduledAt: original } });
  const open = () => {
    find(runtime.render(), node => node.type === 'button' && node.props.children === 'Chọn giờ').props.onClick();
    return runtime.render();
  };
  let tree = open();
  assert.equal(find(tree, node => node.type === 'schedule-modal').props.open, true);
  find(tree, node => node.type === 'schedule-picker').props.onChange('2099-01-02T21:00');
  assert.equal(runtime.draft().scheduledAt, original);
  find(runtime.render(), node => node.type === 'button' && node.props.children === 'Hủy').props.onClick();
  assert.equal(find(runtime.render(), node => node.type === 'schedule-modal').props.open, false);
  assert.equal(runtime.draft().scheduledAt, original);
  tree = open();
  find(tree, node => node.type === 'schedule-picker').props.onChange('2099-01-02T21:01');
  tree = runtime.render();
  assert.equal(find(tree, node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  runtime.render();
  assert.equal(runtime.draft().scheduledAt, original);
  find(tree, node => node.type === 'schedule-picker').props.onChange('2099-01-02T21:00');
  find(runtime.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  runtime.render();
  assert.equal(runtime.draft().scheduledAt, '2099-01-02T21:00');
});

test('Form ngày giờ thông thường giữ khung 08–21, phút 00 ở giờ 21 và khóa khi đang thanh toán', () => {
  const { QuickRebookingSchedulePicker } = load('features/booking/components/QuickRebookingSchedulePicker.tsx');
  let value = '2099-01-01T14:30';
  let disabled = false;
  const render = () => QuickRebookingSchedulePicker({ value, disabled, onChange: next => { value = next; } });
  const field = (tree, label) => find(tree, node => node.props?.['aria-label'] === label);
  const values = select => [select.props.children].flat(Infinity).filter(node => node?.type === 'option' && node.props.value).map(node => node.props.value);
  let tree = render();
  assert.equal(field(tree, 'Ngày hẹn').props.type, 'date');
  assert.equal(field(tree, 'Ngày hẹn').props.value, '2099-01-01');
  assert.deepEqual(values(field(tree, 'Giờ hẹn')), Array.from({ length: 14 }, (_, index) => String(index + 8).padStart(2, '0')));
  field(tree, 'Giờ hẹn').props.onChange({ target: { value: '21' } });
  assert.equal(value, '2099-01-01T21:00');
  tree = render();
  assert.deepEqual(values(field(tree, 'Phút hẹn')), ['00']);
  const nextDate = '2099-01-02';
  field(tree, 'Ngày hẹn').props.onChange({ target: { value: nextDate } });
  assert.equal(value, `${nextDate}T21:00`);
  disabled = true;
  tree = render();
  assert.equal(tree.props.disabled, true);
  field(tree, 'Giờ hẹn').props.onChange({ target: { value: '20' } });
  assert.equal(value, `${nextDate}T21:00`);
});

test('Xem hồ sơ mở bảng bên cạnh, không tự chọn thợ; chỉ chọn thợ còn khả dụng', () => {
  const hooks = hooksRuntime();
  const { QuickRebookingProviderPicker } = load('features/booking/components/QuickRebookingProviderPicker.tsx', {
    react: { ...hooks.react, useId: () => 'quick-provider' },
    './BookingProviderDetails': { BookingProviderDetails: 'provider-profile' },
  });
  let available = providers;
  let selectedId;
  const changes = [], busy = [];
  const render = () => hooks.render(() => QuickRebookingProviderPicker({ providers: available, selectedId,
    oldProvider: { id: 'tho-cu', name: 'Nguyễn Văn An' }, disabled: false, loading: false,
    onChange: (...args) => { changes.push(args); selectedId = args[0]; }, onBusyChange: value => busy.push(value) }));
  let tree = render();
  assert.equal(find(tree, node => node.type === 'details').props.open, false);
  assert.equal(find(tree, node => node.type === 'summary').props.children, 'Handigo điều phối');
  assert.equal(find(tree, node => node.type === 'button'), undefined);
  find(tree, node => node.type === 'details').props.onToggle({ currentTarget: { open: true } });
  tree = render();
  find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Xem hồ sơ thợ Nguyễn Văn An').props.onClick();
  tree = render();
  assert.equal(find(tree, node => node.type === 'details').props.open, false);
  assert.equal(changes.length, 0);
  assert.equal(busy.at(-1), true);
  let profile = find(tree, node => node.type === 'provider-profile');
  assert.equal(profile.props.providerId, 'tho-cu');
  assert.equal(profile.props.canSelect, true);
  available = [];
  profile = find(render(), node => node.type === 'provider-profile');
  assert.equal(profile.props.canSelect, false);
  profile.props.onSelect();
  assert.equal(changes.length, 0);
  available = providers;
  find(render(), node => node.type === 'provider-profile').props.onSelect();
  assert.deepEqual(changes, [['tho-cu', 'Nguyễn Văn An']]);
  assert.equal(busy.at(-1), false);
  tree = render();
  assert.equal(find(tree, node => node.type === 'provider-profile'), undefined);
  assert.equal(find(tree, node => node.type === 'summary').props.children, 'Nguyễn Văn An');
  find(tree, node => node.type === 'details').props.onToggle({ currentTarget: { open: true } });
  tree = render();
  find(tree, node => node.type === 'input' && node.props.type === 'radio').props.onChange();
  assert.deepEqual(changes.at(-1), [undefined, undefined]);
  assert.equal(find(render(), node => node.type === 'details').props.open, false);
  assert.equal(find(render(), node => node.type === 'summary').props.children, 'Handigo điều phối');
});

test('Bảng nhanh mặc định Sớm nhất, hiện giá xác nhận; bấm liên tiếp chỉ gửi một lần và giữ thông tin mới', async () => {
  const runtime = panelRuntime();
  let tree = runtime.render();
  assert.equal(runtime.draft().orderType, 'normal');
  assert.equal(runtime.draft().preferredProviderId, undefined);
  assert.match(confirmButton(tree).props.children, /210/);
  const initialConsent = runtime.keys.at(-1);
  find(tree, node => node.type === 'provider-picker').props.onChange('tho-cu', 'Nguyễn Văn An');
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
