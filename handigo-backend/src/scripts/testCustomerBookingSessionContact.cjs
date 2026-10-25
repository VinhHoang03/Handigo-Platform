const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const webRoot = path.resolve(__dirname, '../../../handigo-web');
const webRequire = createRequire(path.join(webRoot, 'package.json'));
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const storage = () => { const values = new Map(); return {
  getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
}; };
const sessionStorage = storage(), localStorage = storage();
let createOrder, getOrder, paymentCalls = 0, discardCalls = 0, navigations = 0;
const bookingApi = {
  createOrder: (...args) => createOrder(...args), getOrderById: (...args) => getOrder(...args),
  createPayment: async () => { paymentCalls++; return { payment: { status: 'paid' } }; },
  discardUnpaidOrder: async () => { discardCalls++; },
};
const stubs = {
  '@/features/booking/api/booking.api': { bookingApi }, '../api/booking.api': { bookingApi },
  '@/components/common/InitialsAvatar': { InitialsAvatar: () => null },
  '@/components/common/ReliableImage': { ReliableImage: () => null },
  '@/utils/imageUrl': { normalizeImageUrl: value => value },
};
// Tái sử dụng module thật, Zustand và React thật; không gọi API hoặc đọc cấu hình môi trường.
function runtime() {
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(webRoot, 'src', relative);
    if (!fs.existsSync(filename)) filename = ['.ts', '.tsx'].map(ext => filename + ext).find(fs.existsSync);
    assert(filename, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const requireModule = name => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('.')) return load(path.relative(path.join(webRoot, 'src'), path.resolve(path.dirname(filename), name)));
      return webRequire(name);
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, { exports, require: requireModule, sessionStorage, localStorage, console,
      setTimeout, clearTimeout, window: { location: { origin: 'https://example.test' } } }, { filename });
    return exports;
  }
  return { load };
}
const first = runtime();
const auth = first.load('features/auth/store/auth.store').useAuthStore;
const booking = first.load('features/booking/hooks/useBookingStore').useBookingStore;
const session = first.load('features/booking/utils/bookingSessionStorage');
const userA = { id: 'A', fullName: 'A' }, userB = { id: 'B', fullName: 'B' };
function draft() {
  booking.getState().setProblemDescription('Mo ta rieng cua A');
  booking.getState().setCustomerAttachments(['https://example.test/anh-A.jpg']);
  booking.getState().setAddressId('dia-chi-A');
  sessionStorage.setItem(session.PENDING_ORDER_ID_KEY, 'don-A');
  sessionStorage.setItem(session.PENDING_ORDER_FINGERPRINT_KEY, 'ban-nhap-A');
  sessionStorage.setItem(session.PENDING_ORDER_VOUCHER_KEY, 'ma-A');
  sessionStorage.setItem('latestBookingOrderId', 'don-A');
}
function assertCleared() {
  assert.equal(booking.getState().problemDescription, undefined);
  assert.equal(booking.getState().customerAttachments.length, 0);
  assert.equal(booking.getState().addressId, undefined);
  for (const key of [session.PENDING_ORDER_ID_KEY, session.PENDING_ORDER_FINGERPRINT_KEY,
    session.PENDING_ORDER_VOUCHER_KEY, 'latestBookingOrderId', 'handigo:booking-session']) {
    assert.equal(sessionStorage.getItem(key), null, key);
  }
}
async function main() {
  auth.getState().setAuth(userA, 'gia-lap-A'); draft();
  const revision = session.getBookingSessionRevision();
  auth.getState().setUser({ ...userA, fullName: 'A cap nhat' });
  auth.getState().setAuth(userA, 'gia-lap-A-moi');
  assert.equal(session.getBookingSessionRevision(), revision);
  assert.equal(booking.getState().customerAttachments.length, 1);
  const restored = runtime();
  const restoredAuth = restored.load('features/auth/store/auth.store').useAuthStore;
  restoredAuth.getState().setUser(userA);
  assert.equal(restored.load('features/booking/hooks/useBookingStore').useBookingStore.getState().addressId, 'dia-chi-A');
  auth.getState().logout(); assertCleared();
  auth.getState().setAuth(userB, 'gia-lap-B'); assertCleared();
  draft(); auth.getState().setAuth(userA, 'gia-lap-A'); assertCleared();

  let resolveOrder;
  createOrder = () => new Promise(resolve => { resolveOrder = resolve; });
  const submit = first.load('features/booking/components/confirmPaymentSubmit').runConfirmPaymentSubmit;
  const task = submit({
    policyAccepted: true, expectedBookingAmount: 100000, expectedFinalAmount: 100000,
    serviceId: 'dich-vu', addressId: 'dia-chi', orderType: 'normal',
    service: { serviceType: 'fixed_price', fixedPrice: 100000 }, selectedOptionIds: [], customerAttachments: [],
    effectivePaymentMethod: 'wallet', appliedVoucher: null, voucherCode: '', pendingOrderId: '',
    bookingFingerprint: 'ban-nhap', isAppointment: false, isOptionSelectionMissing: false,
    showSystemAlert() {}, setPaymentError() {}, setVoucherError() {}, setIsSubmitting() {}, setPendingOrderId() {},
    reset: () => booking.getState().reset(), navigate: () => { navigations++; },
  });
  assert(resolveOrder);
  auth.getState().logout(); auth.getState().setAuth(userB, 'gia-lap-B');
  resolveOrder({ _id: 'don-A' }); await task;
  assert.equal(paymentCalls, 0); assert.equal(navigations, 0); assertCleared();

  let resolveRecovery;
  getOrder = () => new Promise(resolve => { resolveRecovery = resolve; });
  const recovery = first.load('features/booking/components/pendingBookingRecovery').recoverPendingBooking('don-A');
  auth.getState().logout();
  resolveRecovery({ _id: 'don-A', paymentStatus: 'unpaid' });
  await assert.rejects(recovery);
  assert.equal(discardCalls, 0);

  const utils = first.load('features/provider/utils/providerOrder.utils');
  const { CustomerInformationCard } = first.load('features/provider/components/orders/CustomerInformationCard');
  const order = { customerId: { _id: 'A', fullName: 'Nguoi dat A', phone: '0901111111' },
    addressId: { recipientName: 'Nguoi nhan B', recipientPhone: '0902222222' },
    serviceId: { name: 'Dich vu' }, orderCode: 'DON-TEST', createdAt: '2026-10-25T03:00:00Z' };
  const html = renderToStaticMarkup(React.createElement(CustomerInformationCard, {
    order, customer: utils.getCustomer(order), addressLine: 'Dia chi', orderType: 'Hen gio',
  }));
  assert(html.includes('Nguoi dat A')); assert(html.includes('Nguoi nhan B'));
  assert(html.includes('0902222222')); assert(!html.includes('0901111111'));
  assert.equal(order.customerId._id, 'A');
  order.addressId = null;
  assert.equal(utils.getOrderRecipient(order).phone, '0901111111');
  order.addressId = { recipientName: ' ', recipientPhone: '' };
  assert.equal(utils.getOrderRecipient(order).fullName, 'Nguoi dat A');
  console.log('Đạt: tách bản nháp giữa tài khoản, giữ khôi phục cùng tài khoản, chặn phản hồi cũ và hiển thị đúng người nhận.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
