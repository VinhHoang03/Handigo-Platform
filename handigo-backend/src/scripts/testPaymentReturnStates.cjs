const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const load = (relative) => {
  const file = path.resolve(__dirname, '../../../handigo-web/src', relative);
  const module = new Module(file);
  module.require = (name) => name === './paymentReturnState'
    ? load('features/booking/utils/paymentReturnState.ts') : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return module.exports;
};
const { getPaymentReturnState } = load('features/booking/utils/paymentReturnState.ts');
assert.equal(getPaymentReturnState({ status: 'paid' }), 'paid');
assert.equal(getPaymentReturnState({ status: 'pending', gatewayResponse: { paymentLink: { status: 'PAID' } } }), 'pending');
assert.equal(getPaymentReturnState({ status: 'failed', gatewayResponse: { paymentLink: { status: 'PENDING' }, reconciliation: { status: 'CANCELLED' } } }), 'cancelled');
assert.equal(getPaymentReturnState({ status: 'failed', gatewayResponse: { reconciliation: { status: 'EXPIRED' } } }), 'failed');
assert.equal(getPaymentReturnState({ status: 'refunded' }), 'refunded');
assert.equal(getPaymentReturnState(null), 'pending');
const { getBookingResultState } = load('features/booking/utils/bookingResultState.ts');
const order = { status: 'created', paymentStatus: 'unpaid' };
assert.equal(getBookingResultState(order, { method: 'cash', status: 'pending' }), 'booked');
assert.equal(getBookingResultState(order, null), 'pending');
assert.equal(getBookingResultState(order, { status: 'pending' }), 'pending');
assert.equal(getBookingResultState(order, { status: 'failed', gatewayResponse: { reconciliation: { status: 'CANCELLED' } } }), 'cancelled');
assert.equal(getBookingResultState(order, { status: 'failed' }), 'failed');
assert.equal(getBookingResultState({ ...order, paymentStatus: 'paid' }, null), 'paid');
assert.equal(getBookingResultState({ ...order, paymentStatus: 'refunded' }, null), 'refunded');
assert.equal(getBookingResultState({ ...order, status: 'cancelled', paymentStatus: 'refunded' }, null), 'refunded');
assert.equal(getBookingResultState({ ...order, inspectionRequired: true, paymentStatus: 'partially_paid', depositPaidAt: '2026-10-13' }, null), 'paid');
assert.equal(getBookingResultState({ ...order, inspectionRequired: true, paymentStatus: 'partially_paid', depositPaidAt: '2026-10-13' }, { status: 'failed' }), 'failed');
assert.equal(getBookingResultState({ ...order, status: 'cancelled' }, { status: 'paid' }), 'order_cancelled');
const { getPostLoginPath } = load('features/auth/utils/roleNavigation.ts');
const returned = '/payment/success?orderId=507f1f77bcf86cd799439011&status=PAID';
assert.equal(getPostLoginPath('CUSTOMER', null, returned), returned);
const bookingResult = '/customer/bookings/result?orderId=507f1f77bcf86cd799439011&payos=cancel';
assert.equal(getPostLoginPath('CUSTOMER', null, bookingResult), bookingResult);
const legacyResult = '/customer/bookings/success?orderId=507f1f77bcf86cd799439011&payos=cancel';
assert.equal(getPostLoginPath('CUSTOMER', null, legacyResult), legacyResult);
assert.equal(getPostLoginPath('CUSTOMER', null, '//ngoai.example.com/payment/success'), '/customer');
assert.equal(getPostLoginPath('PROVIDER', 'APPROVED', returned), '/provider');
console.log('Đạt: kết quả thanh toán dựa trên trạng thái backend, xử lý hủy/thất bại/chờ và giữ mã đơn sau đăng nhập an toàn.');
