const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const webRoot = path.resolve(__dirname, '../../../handigo-web/src');
const webRequire = Module.createRequire(path.join(webRoot, 'App.tsx'));
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');

function load(relative, stubs = {}) {
  const file = path.join(webRoot, relative);
  const loaded = new Module(file);
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const original = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, stubs);
    if (name.startsWith('.')) {
      const local = path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx'].map(extension => local + extension).find(candidate => fs.existsSync(candidate));
      if (resolved) return load(path.relative(webRoot, resolved), stubs);
    }
    return original(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
  return loaded.exports;
}

function hooks() {
  const values = []; let cursor = 0;
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useCallback: value => value,
    useEffect: () => {},
  };
  return { react, render: fn => { cursor = 0; return fn(); } };
}

async function run() {
  global.window = { location: { origin: 'https://localhost:5173' } };
  const orderId = '507f1f77bcf86cd799439011';
  const order = { _id: orderId, status: 'created', bookingStatus: 'not_required', orderType: 'normal',
    serviceId: { name: 'Vệ sinh', serviceType: 'fixed_price' }, paymentMethod: 'bank', paymentStatus: 'unpaid',
    addressId: { fullAddress: '123 Đường Nguyễn Trãi, Phường Bến Thành, TP Hồ Chí Minh', ward: 'Bến Thành', province: 'TP Hồ Chí Minh' },
    updatedAt: '2026-10-14T01:00:00Z', statusHistory: [{ status: 'created', createdAt: '2026-10-14T00:00:00Z' }],
    pricing: { baseAmount: 30000, bookingAmount: 30000, totalPaidAmount: 30000, promotionDiscountAmount: 0, voucherDiscountAmount: 0 } };
  const dataHooks = hooks(); let reads = 0;
  const dataApi = {
    getOrderById: async () => ({ ...order, paymentStatus: ++reads === 1 ? 'unpaid' : 'paid' }),
    reconcilePayosPayment: async () => ({ order: { ...order, serviceId: 'ma-dich-vu', addressId: 'ma-dia-chi', statusHistory: undefined } }),
    getPaymentsByOrder: async () => ({ payments: [] }), getQuotation: async () => null,
  };
  const { useBookingDetailData } = load('features/booking/components/detail/useBookingDetailData.ts', {
    react: dataHooks.react, '@/components/common/Toast': { useToastFeedback: dataHooks.react.useState },
    '@/features/booking/api/booking.api': { bookingApi: dataApi }, '@/realtime/authenticatedSocket': {},
  });
  await dataHooks.render(() => useBookingDetailData(orderId)).loadData();
  const detail = dataHooks.render(() => useBookingDetailData(orderId));
  assert.equal(reads, 2);
  assert.equal(detail.order.serviceId.name, 'Vệ sinh');
  assert.equal(detail.order.statusHistory.length, 1);
  assert.equal(detail.order.paymentStatus, 'paid');

  for (const method of ['WALLET', 'CASH', 'PAYOS']) {
    const paymentHooks = hooks(); const navigations = []; let submitted;
    const { useBookingPaymentFlow } = load('features/booking/components/detail/useBookingPaymentFlow.ts', {
      react: paymentHooks.react, 'react-router-dom': { useNavigate: () => value => navigations.push(value) },
      '@/components/common/Toast': { useToast: () => ({ addToast: () => {} }), useToastFeedback: paymentHooks.react.useState },
      '@/api/tokenStorage': { tokenStorage: {} },
      '@/features/booking/api/booking.api': { bookingApi: { createPayment: async payload => {
        submitted = payload; return { payment: { status: method === 'CASH' ? 'pending' : 'paid', method: method.toLowerCase() } };
      } } },
    });
    const render = () => useBookingPaymentFlow(order, false, () => {});
    paymentHooks.render(render).setInitialPaymentMethod(method);
    await paymentHooks.render(render).handleInitialPayment();
    assert.equal(submitted.method, method);
    assert.deepEqual(navigations, [`/customer/bookings/result?orderId=${orderId}`]);
  }

  const { formatOrderAddress } = load('features/booking/components/detail/bookingDetailProvider.ts');
  assert.equal(formatOrderAddress(order), order.addressId.fullAddress);
  const { BookingSuccessPaymentSummary } = load('features/booking/components/BookingSuccessPaymentSummary.tsx');
  const { formatCurrency } = load('utils/currency.ts');
  const inspection = { ...order, inspectionRequired: true, serviceId: { serviceType: 'variable_price' },
    depositPaidAt: '2026-10-14T00:00:00Z', status: 'completed', paymentStatus: 'paid' };
  const quotation = { quotation: { status: 'saved', finalAmount: 500000, directPaymentConfirmedAt: '2026-10-14T01:00:00Z', directPaymentConfirmedAmount: 470000 }, items: [] };
  const renderSummary = (currentOrder, currentQuotation, result) => renderToStaticMarkup(React.createElement(BookingSuccessPaymentSummary, { order: currentOrder, quotation: currentQuotation, result }));
  const paid = renderSummary(inspection, quotation, 'paid');
  assert.ok(paid.includes('Tổng theo báo giá') && paid.includes(formatCurrency(500000)));
  assert.ok(paid.includes('Tiền sửa chữa đã thu') && paid.includes(formatCurrency(470000)));
  assert.ok(paid.includes('Còn cần thanh toán') && paid.includes(formatCurrency(0)));
  assert.ok(!paid.includes(formatCurrency(530000)), 'Không được cộng cọc lần nữa vào tổng báo giá.');
  const unconfirmed = renderSummary({ ...inspection, paymentStatus: 'partially_paid' }, { quotation: { status: 'saved', finalAmount: 500000 }, items: [] }, 'paid');
  assert.ok(unconfirmed.includes('Chưa xác nhận') && unconfirmed.includes('Đã thanh toán cọc'));
  const refunded = renderSummary({ ...inspection, status: 'cancelled', paymentStatus: 'refunded' }, quotation, 'refunded');
  assert.ok(refunded.includes('Đã hoàn tiền') && !refunded.includes('Còn cần thanh toán'));
  const depositOnly = renderSummary(inspection, null, 'paid');
  assert.ok(depositOnly.includes('Tiền cọc sau giảm') && !depositOnly.includes('Tổng theo báo giá'));
  const cancelledPaid = renderSummary({ ...inspection, status: 'cancelled' }, quotation, 'order_cancelled');
  assert.ok(cancelledPaid.includes('Đã thanh toán') && !cancelledPaid.includes('Còn cần thanh toán'));
  const discounted = renderSummary({ ...inspection, pricing: { ...inspection.pricing, voucherDiscountAmount: 10000, totalPaidAmount: 20000 } },
    { quotation: { ...quotation.quotation, directPaymentConfirmedAmount: 480000 }, items: [] }, 'paid');
  assert.ok(discounted.includes(formatCurrency(20000)) && discounted.includes(formatCurrency(480000)));
  const zero = renderSummary({ ...inspection, pricing: { ...inspection.pricing, totalPaidAmount: 0 } },
    { quotation: { ...quotation.quotation, finalAmount: 0, directPaymentConfirmedAmount: 0 }, items: [] }, 'paid');
  assert.ok(!zero.includes('Chưa xác nhận'));
  for (const cancelled of [true, false]) {
    const pageHooks = hooks(); let effect; let timer;
    pageHooks.react.useRef = initial => pageHooks.react.useState(() => ({ current: initial }))[0];
    pageHooks.react.useEffect = callback => { effect = callback; };
    global.sessionStorage = { getItem: () => null };
    global.window.setTimeout = callback => { timer = callback; return 1; };
    global.window.clearTimeout = () => {};
    const { default: BookingResultPage } = load('features/booking/pages/BookingResultPage.tsx', {
      react: pageHooks.react,
      'react-router-dom': {
        useLocation: () => ({ search: `?orderId=${orderId}` }),
        Link: ({ to, children }) => React.createElement('a', { href: to }, children),
      },
      '../api/booking.api': { bookingApi: {
        getOrderById: async () => ({ ...order, status: cancelled ? 'cancelled' : 'created' }),
        reconcilePayosPayment: async () => { throw new Error('PayOS tạm thời không phản hồi.'); },
      } },
      '../hooks/useBookingStore': { useBookingStore: () => () => {} },
      '../components/confirmPaymentSubmit': { PENDING_ORDER_ID_KEY: 'pendingBookingOrderId', PENDING_ORDER_FINGERPRINT_KEY: 'pendingBookingFingerprint' },
      '../components/BookingComponents': { BookingShell: ({ children }) => children },
      '../components/BookingSuccessOrderCard': { BookingSuccessOrderCard: () => null },
      '../components/BookingSuccessPaymentSummary': { BookingSuccessPaymentSummary: () => null },
      '../components/BookingSuccessSkeleton': { BookingSuccessSkeleton: () => null },
      '../components/BookingSuccessLocationPreview': { BookingSuccessLocationPreview: () => null },
      '@/components/common/AsyncState': { AsyncState: ({ loading, children }) => loading ? null : children },
    });
    pageHooks.render(BookingResultPage);
    effect(); timer();
    await new Promise(resolve => setImmediate(resolve));
    const html = renderToStaticMarkup(pageHooks.render(BookingResultPage));
    assert.ok(html.includes('Kiểm tra lại kết quả'));
    if (cancelled) {
      assert.ok(html.includes('Đơn hàng đã hủy') && html.includes('Chưa xác minh được giao dịch hoặc thông tin hoàn tiền'));
      assert.ok(!html.includes('Tiếp tục thanh toán'));
    } else {
      assert.ok(html.includes('Chưa thể xác minh thanh toán') && html.includes('Tiếp tục thanh toán'));
    }
  }
  console.log('Đạt: giữ dữ liệu sau đối soát, điều hướng ví/tiền mặt/PayOS, địa chỉ đầy đủ, báo giá và hoàn tiền.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
