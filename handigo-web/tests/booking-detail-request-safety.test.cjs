const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, console: { error() {} }, Date, Promise,
    require: name => name in modules ? modules[name] : name.startsWith('.') || name.startsWith('@/') ? {} : require(name) });
  return exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture() {
  const state = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return state[index] ??= { current: initial }; },
    useCallback: callback => callback,
    useEffect() {},
  };
  const requests = [];
  const api = {
    getOrderById: id => { const request = { id, ...deferred() }; requests.push(request); return request.promise; },
    getPaymentsByOrder: async id => ({ payments: [{ _id: `thanh-toan-${id}` }] }),
    getQuotation: async id => ({ quotation: { _id: `bao-gia-${id}`, revision: 1 } }),
  };
  const { useBookingDetailData } = load('features/booking/components/detail/useBookingDetailData.ts', {
    react, '@/features/booking/api/booking.api': { bookingApi: api },
    '@/components/common/Toast': { useToastFeedback: initial => react.useState(initial) },
    '@/realtime/authenticatedSocket': {},
  });
  return {
    requests,
    render(id) { cursor = 0; return useBookingDetailData(id); },
  };
}
const order = id => ({ _id: id, updatedAt: '2026-10-25T00:00:00Z', paymentMethod: 'cash',
  paymentStatus: 'unpaid', orderType: 'normal' });

test('KH-17: phản hồi A đến sau B không ghi đè đơn, thanh toán, báo giá hoặc popup', async () => {
  const app = fixture();
  const first = app.render('A').loadData();
  const second = app.render('B').loadData();
  app.requests[1].resolve(order('B')); await second;
  app.requests[0].resolve({ ...order('A'), reassignment: { status: 'awaiting_customer' } }); await first;
  const data = app.render('B');
  assert.equal(data.order._id, 'B');
  assert.equal(data.payments[0]._id, 'thanh-toan-B');
  assert.equal(data.quotation.quotation._id, 'bao-gia-B');
  assert.equal(data.reassignmentModalOpen, false);
  assert.equal(data.loading, false);
});

test('KH-17: A → B → A vẫn bỏ qua lượt A đầu và lỗi B cũ', async () => {
  const app = fixture();
  const first = app.render('A').loadData();
  const second = app.render('B').loadData();
  const third = app.render('A').loadData();
  app.requests[2].resolve({ ...order('A'), orderCode: 'LUOT-MOI' }); await third;
  app.requests[0].resolve({ ...order('A'), orderCode: 'LUOT-CU' }); await first;
  app.requests[1].reject(new Error('Lỗi cũ')); await second;
  const data = app.render('A');
  assert.equal(data.order.orderCode, 'LUOT-MOI');
  assert.equal(data.apiError, null); assert.equal(data.loading, false);
});

test('KH-17: trang tạo lại toàn bộ trạng thái thao tác theo mã đơn trên URL', () => {
  let bookingId = 'A';
  const Page = load('features/booking/pages/BookingDetailPage.tsx', {
    'react-router-dom': { useParams: () => ({ bookingId }) },
  }).default;
  const first = Page(); bookingId = 'B'; const second = Page(); bookingId = 'A'; const third = Page();
  assert.equal(first.type, second.type);
  assert.equal(first.key, 'A'); assert.equal(second.key, 'B'); assert.equal(third.key, 'A');
});
