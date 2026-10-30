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
  }).outputText, { exports, ...globals, require: name => {
    if (name in modules) return modules[name]; throw new Error(`Chưa giả lập module: ${name}`);
  } });
  return exports;
}
const quotationPayment = load('utils/quotationPayment.ts', {});
function fixture(quotationOrder = true) {
  const slots = [], requests = [], toasts = [], redirects = [], navigations = [];
  let cursor = 0, busy = false, prepared = 0;
  const useState = initial => {
    const index = cursor++; slots[index] ??= { value: initial };
    return [slots[index].value, value => { slots[index].value = value; }];
  };
  const order = { _id: 'don-thu', inspectionRequired: quotationOrder, status: quotationOrder ? 'completed' : 'in_progress',
    depositPaidAt: '2026-10-29', paymentStatus: quotationOrder ? 'partially_paid' : 'unpaid', paymentMethod: 'cash',
    pricing: { totalPaidAmount: 20000 } };
  const quotation = { quotation: { _id: 'bao-gia-thu', status: 'saved', revision: 2, finalAmount: 200000, directPaymentConfirmedAt: null } };
  const { useBookingPaymentFlow } = load('features/booking/components/detail/useBookingPaymentFlow.ts', {
    react: { useState, useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; } },
    'react-dom': { flushSync: work => work() },
    'react-router-dom': { useNavigate: () => url => navigations.push(url) },
    '@/api/tokenStorage': { tokenStorage: { prepareExternalRedirect: () => prepared++ } },
    '@/components/common/Toast': { useToastFeedback: useState, useToast: () => ({ addToast: (...args) => toasts.push(args) }) },
    '@/features/booking/api/booking.api': { bookingApi: {
      getOrderById: async () => order,
      createPayment: payload => new Promise((resolve, reject) => requests.push({ payload, resolve, reject })),
    } },
    '@/utils/apiError': { getErrorMessage: error => error.message },
  }, { window: { location: { origin: 'https://handigo.test', assign: url => redirects.push(url) } }, console: { error() {} } });
  const render = (amount = 180000) => {
    cursor = 0;
    return useBookingPaymentFlow(order, busy, value => { busy = value; }, true, () => {},
      quotationOrder ? { quotation, amount } : undefined);
  };
  const open = method => { render().openInitialPaymentModal(); render().setInitialPaymentMethod(method); return render(); };
  return { order, quotation, requests, toasts, redirects, navigations, render, open, get prepared() { return prepared; } };
}

test('Báo giá dùng luồng chung: đúng phần còn lại, phiên bản và chống bấm nhiều lần', async () => {
  const f = fixture(), flow = f.open('WALLET');
  const first = flow.handleInitialPayment(); await flow.handleInitialPayment();
  assert.equal(f.requests.length, 1);
  const payload = f.requests[0].payload;
  assert.equal(payload.method, 'WALLET'); assert.equal(payload.paymentType, 'REMAINING');
  assert.equal(payload.expectedAmount, 180000); assert.equal(payload.quotationId, 'bao-gia-thu'); assert.equal(payload.expectedRevision, 2);
  f.requests[0].resolve({ payment: { status: 'paid', method: 'wallet' } }); await first;
  assert.equal(f.render().paymentMethodModalOpen, false); assert.equal(f.navigations.length, 1);
});

test('Báo giá PayOS dùng liên kết backend và chuẩn bị phiên trước khi chuyển trang', async () => {
  const f = fixture(), flow = f.open('PAYOS');
  const task = flow.handleInitialPayment();
  assert.equal(f.requests[0].payload.paymentType, 'REMAINING');
  assert.match(f.requests[0].payload.cancelUrl, /bookings\/don-thu\?payos=cancel$/);
  f.requests[0].resolve({ payment: { status: 'pending', method: 'payos' }, checkoutUrl: 'https://pay.test/qr' }); await task;
  assert.deepEqual(f.redirects, ['https://pay.test/qr']); assert.equal(f.prepared, 1); assert.equal(f.navigations.length, 0);
});

test('Báo giá hoặc số tiền thay đổi sau mở cửa sổ thì không thanh toán', async () => {
  for (const changeAmount of [false, true]) {
    const f = fixture(); f.open('WALLET');
    if (!changeAmount) f.quotation.quotation.revision++;
    await f.render(changeAmount ? 190000 : 180000).handleInitialPayment();
    assert.equal(f.requests.length, 0); assert.match(f.render().paymentError, /đã thay đổi/);
  }
});

test('Thiếu ví giữ cửa sổ và cho phép chọn PayOS để thử lại', async () => {
  const f = fixture(), flow = f.open('WALLET');
  const pending = flow.handleInitialPayment(); f.requests[0].reject(new Error('Số dư ví không đủ')); await pending;
  assert.match(f.render().paymentError, /không đủ/); assert.equal(f.render().paymentMethodModalOpen, true);
  f.render().setInitialPaymentMethod('PAYOS');
  const retry = f.render().handleInitialPayment(); assert.equal(f.requests[1].payload.method, 'PAYOS');
  f.requests[1].resolve({ payment: { status: 'pending' }, checkoutUrl: 'https://pay.test/qr' }); await retry;
});

test('PayOS vừa nhận tiền khi đổi sang ví thì không mở QR mới', async () => {
  const f = fixture(), flow = f.open('WALLET');
  const task = flow.handleInitialPayment(); f.requests[0].resolve({ payment: { status: 'paid', method: 'payos' } }); await task;
  assert.equal(f.redirects.length, 0); assert.match(f.toasts[0][0], /không thu thêm tiền/);
});

test('Đơn cố định vẫn thanh toán FULL và giữ đúng số tiền của đơn', async () => {
  const f = fixture(false), flow = f.open('WALLET');
  const task = flow.handleInitialPayment();
  assert.equal(f.requests[0].payload.paymentType, 'FULL'); assert.equal(f.requests[0].payload.expectedAmount, 20000);
  assert.equal(f.requests[0].payload.quotationId, undefined);
  f.requests[0].resolve({ payment: { status: 'paid', method: 'wallet' } }); await task;
});

test('Đã thanh toán ví hoặc PayOS thì không hiển thị khoản cần trả lại', () => {
  const f = fixture(); f.order.paymentStatus = 'paid';
  for (const method of ['wallet', 'bank']) {
    f.order.paymentMethod = method;
    assert.equal(quotationPayment.isQuotationPaidOnline(f.order, f.quotation.quotation), true);
    assert.equal(quotationPayment.getRemainingQuotationPayment(f.quotation.quotation, 20000, 'completed', true), 0);
  }
  f.quotation.quotation.directPaymentConfirmedAt = '2026-10-29';
  assert.equal(quotationPayment.isQuotationPaidOnline(f.order, f.quotation.quotation), false);
});
