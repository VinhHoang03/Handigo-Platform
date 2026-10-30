const { test } = require('node:test');

test('KH-29/KH-30: lịch sử có bộ lọc đã nhận, bỏ phản hồi cũ và không tải trùng trang', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const ts = require('typescript');
  const slots = [], requests = [], timers = new Map();
  let cursor = 0, effects = [], timerId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial, set: next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; } };
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(work, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: work };
      return slots[index].value;
    },
    useEffect(work, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: work() };
      });
    },
  };
  const modules = {
    react,
    'react-router-dom': { Link: 'link', useSearchParams: () => [new URLSearchParams('quickRebook=507f1f77bcf86cd799439011')] },
    '../components/RebookButton': { RebookButton: 'rebook-return' },
    '@/components/common/Toast': { useToastFeedback: initial => react.useState(initial) },
    '@/features/booking/api/booking.api': { bookingApi: { getMyOrders(page, limit, status, search) {
      let resolve, reject;
      const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
      requests.push({ page, limit, status, search, resolve, reject }); return promise;
    } } },
    '../components/BookingComponents': { BookingShell: 'shell', BookingPageHeader: 'header', BookingHistoryCard: 'card' },
    '../components/BookingSkeletons': { BookingHistoryListSkeleton: 'skeleton' },
    '@/components/common/AsyncState': { AsyncState: 'async' },
    '@/utils/orderStatus': { getOrderStatusMeta: status => ({ label: status }) },
    '@/utils/currency': { formatCurrency: amount => String(amount) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/features/booking/pages/BookingHistoryPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => modules[name] ?? (name === 'lucide-react' ? {} : require(name)),
    setTimeout(work, delay) { const id = ++timerId; timers.set(id, { work, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const render = () => {
    cursor = 0; effects = []; const tree = exports.default(); effects.forEach(work => work()); return tree;
  };
  const runTimers = delay => {
    for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.work(); }
  };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children, node.props?.action].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
    return null;
  };
  const button = (tree, label) => find(tree, node => node.type === 'button'
    && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === label));
  const ids = tree => {
    const result = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'card') result.push(node.props.booking.id);
      [node.props?.children].flat(Infinity).forEach(visit);
    }
    visit(tree); return result;
  };
  const tick = () => new Promise(setImmediate);
  const respond = (request, entries, total = entries.length) => request.resolve({
    items: entries.map(([id, status]) => ({ _id: id, status })), pagination: { total },
  });
  let tree = render(); runTimers(0);
  const returnForm = find(tree, node => node.type === 'rebook-return');
  assert.equal(returnForm.props.orderId, '507f1f77bcf86cd799439011');
  assert.equal(returnForm.props.restoreOnly, true);
  const oldAll = requests.at(-1);
  button(tree, 'Đã hoàn thành').props.onClick(); tree = render(); runTimers(0);
  assert.equal(requests.at(-1).status, 'completed');
  respond(requests.at(-1), [['hoan-tat', 'completed']]); await tick();
  respond(oldAll, [['cu', 'created']], 100); await tick();
  tree = render(); assert.deepEqual(ids(tree), ['hoan-tat']);
  assert.equal(find(tree, node => node.type === 'async').props.loading, false);

  button(tree, 'Thợ đã nhận').props.onClick(); tree = render(); runTimers(0);
  assert.equal(requests.at(-1).status, 'accepted');
  respond(requests.at(-1), [['da-nhan', 'accepted']], 15); await tick(); tree = render();
  assert.deepEqual(ids(tree), ['da-nhan']);
  const more = button(tree, 'Xem thêm lịch sử');
  const count = requests.length;
  more.props.onClick(); more.props.onClick();
  assert.equal(requests.length, count + 1); assert.equal(requests.at(-1).page, 2);
  const oldAppend = requests.at(-1);
  button(tree, 'Tất cả').props.onClick(); tree = render(); runTimers(0);
  const newAll = requests.at(-1); assert.equal(newAll.page, 1);
  respond(oldAppend, [['trang-cu', 'accepted']], 15); await tick();
  tree = render(); assert.equal(find(tree, node => node.type === 'async').props.loading, true);
  respond(newAll, [['tat-ca-moi', 'created']], 12); await tick(); tree = render();
  assert.deepEqual(ids(tree), ['tat-ca-moi']);
  button(tree, 'Xem thêm lịch sử').props.onClick();
  respond(requests.at(-1), [['tat-ca-moi', 'created'], ['trang-hai', 'accepted']], 12); await tick();
  tree = render(); assert.deepEqual(ids(tree), ['tat-ca-moi', 'trang-hai']);

  // Lỗi của lượt cũ không được đổi lỗi/loading của lượt tìm kiếm mới.
  button(tree, 'Đã hủy').props.onClick(); tree = render(); runTimers(0);
  const staleFailure = requests.at(-1);
  find(tree, node => node.type === 'input').props.onChange({ target: { value: 'don-moi' } });
  tree = render(); runTimers(500); tree = render(); runTimers(0);
  assert.equal(requests.at(-1).search, 'don-moi'); assert.equal(requests.at(-1).page, 1);
  staleFailure.reject(new Error('Lỗi lượt cũ')); await tick();
  tree = render(); assert.equal(find(tree, node => node.type === 'async').props.error, '');
  assert.equal(find(tree, node => node.type === 'async').props.loading, true);
  requests.at(-1).reject(new Error('Lỗi lượt hiện tại')); await tick(); tree = render();
  assert.match(find(tree, node => node.type === 'async').props.error, /Không thể tải/);
  find(tree, node => node.type === 'async').props.onRetry();
  respond(requests.at(-1), [['tim-thay', 'cancelled']]); await tick(); tree = render();
  assert.deepEqual(ids(tree), ['tim-thay']);
  assert.equal(find(tree, node => node.type === 'async').props.error, '');
  // Quay lại cùng bộ lọc vẫn phải phân biệt hai lượt tải khác nhau.
  button(tree, 'Tất cả').props.onClick(); tree = render(); runTimers(0);
  const firstA = requests.at(-1);
  button(tree, 'Đã hoàn thành').props.onClick(); tree = render(); runTimers(0);
  const middleB = requests.at(-1);
  button(tree, 'Tất cả').props.onClick(); tree = render(); runTimers(0);
  respond(requests.at(-1), [['A-moi', 'created']]); await tick();
  respond(firstA, [['A-cu', 'created']]); middleB.reject(new Error('Lỗi B cũ')); await tick();
  tree = render(); assert.deepEqual(ids(tree), ['A-moi']);
  assert.equal(find(tree, node => node.type === 'async').props.error, '');
  button(tree, 'Thợ đã nhận').props.onClick(); tree = render(); runTimers(0);
  const leaving = requests.at(-1);
  slots.forEach(slot => slot?.cleanup?.());
  const beforeUnmount = JSON.stringify(slots.map(slot => slot?.value));
  respond(leaving, [['sau-roi-trang', 'accepted']]); await tick();
  assert.equal(JSON.stringify(slots.map(slot => slot?.value)), beforeUnmount);
});

test('Tiến trình đơn: thời điểm lịch sử, chờ nhận, hoàn tất và hủy', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const ts = require('typescript');

  const file = path.resolve(__dirname, '../src/features/booking/components/detail/bookingDetailTimeline.ts');
  const loaded = new Module(file);
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  const { buildOrderTimeline, formatTimelineTime } = loaded.exports;
  const order = {
    status: 'created', paymentStatus: 'unpaid', orderCode: 'ORD-KIEM-THU',
    serviceId: { name: 'Vệ Sinh Điều Hòa' },
    providerId: { userId: { fullName: 'Nguyễn Văn An' } },
    createdAt: '2026-10-02T13:25:41Z', updatedAt: '2026-10-10T01:00:00Z',
    statusHistory: [{ status: 'created', createdAt: '2026-10-02T13:25:41Z' }],
  };
  const waiting = buildOrderTimeline(order);
  assert.equal(waiting.length, 4, 'Đơn mới có lịch sử vẫn phải hiển thị đủ bốn mốc.');
  assert.deepEqual(waiting.map(step => step.state), ['active', 'pending', 'pending', 'pending']);
  assert.equal(waiting[1].title, 'Chờ chuyên gia nhận đơn', 'Được gán thợ không đồng nghĩa đã nhận đơn.');
  assert.match(waiting[0].description, /Vệ Sinh Điều Hòa.*ORD-KIEM-THU/);
  const cash = buildOrderTimeline({ ...order, paymentMethod: 'cash', paymentStatus: 'unpaid', inspectionRequired: false });
  assert.match(cash[1].description, /tiền mặt/);
  assert.doesNotMatch(cash[1].description, /hoàn tất thanh toán/);
  const completed = buildOrderTimeline({ ...order, status: 'completed', statusHistory: [
    ...order.statusHistory,
    { status: 'accepted', createdAt: '2026-10-02T13:30:00Z' },
    { status: 'in_progress', createdAt: '2026-10-02T14:00:00Z' },
    { status: 'completed', createdAt: '2026-10-08T17:05:17Z' },
  ] });
  assert.equal(completed.length, 4);
  assert.ok(completed.every(step => step.state === 'done'));
  assert.equal(completed[1].title, 'Nguyễn Văn An đã nhận đơn');
  assert.equal(completed[1].time, formatTimelineTime('2026-10-02T13:30:00Z'));
  assert.equal(completed[2].time, formatTimelineTime('2026-10-02T14:00:00Z'));
  assert.equal(completed[3].time, formatTimelineTime('2026-10-08T17:05:17Z'), 'Mốc hoàn thành không lấy thời gian cập nhật sau đó.');
  assert.match(completed[2].description, /đã thực hiện/);
  const legacy = buildOrderTimeline({ ...order, statusHistory: undefined });
  assert.equal(legacy.length, 4);
  assert.equal(legacy[0].time, formatTimelineTime(order.createdAt));
  const cancelled = buildOrderTimeline({ ...order, status: 'cancelled', statusHistory: [
    ...order.statusHistory, { status: 'cancelled', note: 'Khách hủy đơn', createdAt: order.updatedAt },
  ] });
  assert.equal(cancelled.length, 2);
  assert.equal(cancelled[1].state, 'cancelled');
  assert.equal(cancelled[1].title, 'Đơn hàng đã hủy');
  assert.ok(cancelled[1].description.endsWith('Lý do hủy: Khách hủy đơn'));
  assert.ok(cancelled.every(step => !step.title.includes('·') && step.description));
  const cancellation = { reason: 'Khách thay đổi lịch', cancelledAt: '2026-10-13T16:14:06Z' };
  const missingEvent = buildOrderTimeline({ ...order, status: 'cancelled', cancellation });
  assert.ok(missingEvent.at(-1).description.endsWith('Lý do hủy: Khách thay đổi lịch'));
  assert.equal(missingEvent.at(-1).time, formatTimelineTime(cancellation.cancelledAt));
  assert.equal(missingEvent.at(-1).state, 'cancelled');
  const noHistory = buildOrderTimeline({ ...order, status: 'cancelled', cancellation, statusHistory: undefined });
  assert.ok(noHistory[0].description.endsWith('Lý do hủy: Khách thay đổi lịch'));
});

test('Đặt dịch vụ gửi đúng tổng tiền xác nhận và không thu lại đơn đã trả', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const ts = require('typescript');
  const source = path.resolve(__dirname, '../src/features/booking/components/confirmPaymentSubmit.ts');
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
  await (async () => {
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
  })();
});

test('Kết quả đặt dịch vụ giữ dữ liệu sau đối soát và điều hướng đúng', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const ts = require('typescript');
  const webRoot = path.resolve(__dirname, '../src');
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
      useRef: initial => {
        const index = cursor++;
        return values[index] ??= { current: initial };
      },
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
  }
  const previousWindow = global.window;
  try { await run(); }
  finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});

test('Kết quả thanh toán dùng trạng thái backend và giữ đường dẫn an toàn', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const ts = require('typescript');
  const load = (relative) => {
    const file = path.resolve(__dirname, '../src', relative);
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
});

test('Khôi phục đơn chờ và voucher đúng phiên, không thu lại đơn đã trả', async () => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const ts = require('typescript');
  const source = path.resolve(__dirname, '../src/features/booking/components/pendingBookingRecovery.ts');
  let reads = 0, discards = 0, revision = 0, order, readError, discardError, resolveRead;
  const api = {
    getOrderById: async () => {
      reads++;
      if (readError) throw readError;
      if (resolveRead) return resolveRead;
      return order;
    },
    discardUnpaidOrder: async () => { discards++; if (discardError) { order = { ...order, paymentStatus: 'paid' }; throw discardError; } },
  };
  const context = { exports: {}, require: name => {
    if (name === '../api/booking.api') return { bookingApi: api };
    if (name === '../utils/bookingSessionStorage') return { getBookingSessionRevision: () => revision };
    throw new Error(name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const recover = context.exports.recoverPendingBooking;
  await (async () => {
    order = { _id: 'don', paymentStatus: 'unpaid', voucherSnapshot: { code: 'CU30' } };
    const [one, two] = await Promise.all([recover('don'), recover('don')]);
    assert.equal(reads, 1); assert.equal(discards, 1);
    assert.equal(one.voucherCode, 'CU30'); assert.equal(two.voucherCode, 'CU30');
    order.paymentStatus = 'paid';
    assert.equal((await recover('don')).paidOrder._id, 'don'); assert.equal(discards, 1);
    order.paymentStatus = 'unpaid'; discardError = new Error('Thanh toán vừa được xác nhận');
    assert.equal((await recover('don')).paidOrder.paymentStatus, 'paid');
    const before = discards;
    readError = new Error('Mất kết nối');
    await assert.rejects(recover('don')); assert.equal(discards, before);
    readError = null; discardError = null;
    let finish;
    resolveRead = new Promise(resolve => { finish = resolve; });
    const stale = recover('don'); revision++;
    finish({ _id: 'don', paymentStatus: 'unpaid' });
    await assert.rejects(stale); assert.equal(discards, before);
  })();
});
