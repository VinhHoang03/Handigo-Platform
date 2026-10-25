const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = path.resolve(__dirname, '../../../handigo-web/src/features/booking/components/confirmPaymentSubmit.ts');
let currentAmount = 170000, paymentCalls = 0, created = 0, recovery = {}, message = '';
const saved = new Map();
const noop = () => {};
const api = {
  createOrder: async payload => {
    assert.equal(payload.expectedBookingAmount, 200000);
    assert.equal(payload.expectedFinalAmount, 170000);
    if (currentAmount !== payload.expectedFinalAmount) throw { response: { data: { message: 'Tổng tiền sau giảm giá đã thay đổi.' } } };
    created++; return { _id: 'don-xac-nhan' };
  },
  createPayment: async input => {
    paymentCalls++; assert.equal(input.expectedAmount, 170000);
    if (input.method === 'PAYOS') assert.equal(input.cancelUrl, 'https://example.test/customer/bookings/new/payment');
    return { payment: { status: 'paid' } };
  },
  getOrderById: async () => ({ _id: 'don-xac-nhan' }),
};
const dependencies = {
  '@/features/booking/api/booking.api': { bookingApi: api },
  '@/api/tokenStorage': { tokenStorage: {} },
  '@/utils/airConditionerCleaning': { isAirConditionerCleaning: () => false },
  './step2Helpers': { getEarliestScheduledAt: () => new Date(0) },
  '../utils/bookingSessionStorage': { getBookingSessionRevision: () => 0 },
  './confirmPaymentSubmitTypes': { getConfirmPaymentErrorMessage: error => error.response?.data?.message || 'Lỗi kiểm thử.' },
  './pendingBookingRecovery': {
    PENDING_ORDER_ID_KEY: 'order', PENDING_ORDER_FINGERPRINT_KEY: 'fingerprint', PENDING_ORDER_VOUCHER_KEY: 'voucher',
    clearPendingBooking: () => saved.clear(), recoverPendingBooking: async () => recovery,
  },
};
const context = { exports: {}, console: { error: noop }, window: { location: { origin: 'https://example.test' } },
  sessionStorage: { setItem: (key, value) => saved.set(key, value) },
  require: name => { assert(name in dependencies, name); return dependencies[name]; } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const params = {
  policyAccepted: true, serviceId: 'dich-vu', addressId: 'dia-chi', orderType: 'normal',
  service: { serviceType: 'fixed_price' }, selectedOptionIds: [], selectedOptionQuantities: {}, customerAttachments: [],
  effectivePaymentMethod: 'wallet', appliedVoucher: { code: 'GIAM30' }, voucherCode: 'GIAM30', pendingOrderId: '',
  bookingFingerprint: 'thong-tin', expectedBookingAmount: 200000, expectedFinalAmount: 170000,
  isAppointment: false, isOptionSelectionMissing: false, showSystemAlert: noop,
  setPaymentError: value => { message = value; }, setVoucherError: noop, setIsSubmitting: noop,
  setPendingOrderId: noop, reset: noop, navigate: noop,
};
(async () => {
  for (const amount of [190000, 160000]) {
    currentAmount = amount; await context.exports.runConfirmPaymentSubmit(params);
    assert.equal(paymentCalls, 0); assert(message.includes('Tổng tiền sau giảm giá'));
  }
  currentAmount = 170000;
  recovery = { paidOrder: { _id: 'don-da-tra', paymentStatus: 'paid' } };
  await context.exports.runConfirmPaymentSubmit({ ...params, pendingOrderId: 'don-da-tra' });
  assert.equal(created, 0); assert.equal(paymentCalls, 0);
  recovery = {};
  for (const effectivePaymentMethod of ['wallet', 'bank', 'cash']) {
    await context.exports.runConfirmPaymentSubmit({ ...params, effectivePaymentMethod });
  }
  assert.equal(created, 3); assert.equal(paymentCalls, 3);
  await context.exports.runConfirmPaymentSubmit({ ...params, pendingOrderId: 'don-chua-tra' });
  assert.equal(created, 4); assert.equal(paymentCalls, 4);
  console.log('Đạt: kiểm tra giá trước khi tạo đơn, gửi đúng tổng đã xác nhận và không thu lại đơn đã thanh toán.');
})().catch(error => { console.error(error); process.exitCode = 1; });
