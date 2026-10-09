const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Mô phỏng vòng đời React để kiểm tra ảnh QR và polling, không gọi PayOS/CDN.
function harness({ legacy = false, qrFailure = false, reconcilePaid = false } = {}) {
  const slots = [];
  const effects = [];
  const timers = new Map();
  const revoked = [];
  let index = 0;
  let firstRender = true;
  let qrCalls = 0;
  let notified = 0;
  let reconciliations = 0;
  let now = 100000;
  const socketEvents = new Map();
  const pageEvents = new Map();
  const payment = { _id: 'giao-dich', orderId: 'don-hang', method: 'payos', status: 'pending', paymentType: 'full' };
  const bookingApi = {
    getPaymentById: async () => payment,
    getPaymentsByOrder: async () => ({ payments: [payment] }),
    reconcilePayosPayment: async () => { reconciliations++; if (reconcilePaid) payment.status = 'paid'; return { payment }; },
    getPaymentQr: async (id) => {
      assert.equal(id, payment._id);
      qrCalls++;
      if (qrFailure) throw new Error('Chưa có dữ liệu QR từ PayOS.');
      return { type: 'image/png' };
    },
  };
  const react = {
    useState(initial) { const position = index++; if (!(position in slots)) slots[position] = initial;
      return [slots[position], (value) => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }]; },
    useRef(initial) { const position = index++; return slots[position] ??= { current: initial }; },
    useEffect(effect) { if (firstRender) effects.push(effect); },
    useEffectEvent: (callback) => callback,
  };
  const exported = {};
  const source = fs.readFileSync(path.resolve(__dirname, '../src/features/chatbot/components/AgentPayosCheckout.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports: exported, require: (name) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.includes('booking.api')) return { bookingApi };
    if (name.includes('apiError')) return { getErrorMessage: (error) => error.message };
    if (name.includes('authenticatedSocket')) return { createAuthenticatedSocket: () => ({
      socket: { on: (event, callback) => socketEvents.set(event, callback), off: (event) => socketEvents.delete(event) }, dispose() {},
    }) };
    throw new Error(`Không được tải SDK hoặc module ngoài: ${name}`);
  }, URL: { createObjectURL: () => 'blob:qr-pay os', revokeObjectURL: (url) => revoked.push(url) },
  Date: { now: () => now },
  window: { addEventListener: (event, callback) => pageEvents.set(event, callback), removeEventListener: (event) => pageEvents.delete(event) },
  document: { visibilityState: 'visible', addEventListener: (event, callback) => pageEvents.set(event, callback), removeEventListener: (event) => pageEvents.delete(event) },
  setTimeout: (callback) => { const id = timers.size + 1; timers.set(id, callback); return id; },
  clearTimeout: (id) => timers.delete(id) });
  const render = () => { index = 0; const tree = exported.AgentPayosCheckout({
    payment: { orderId: payment.orderId, orderCode: 'ORD-QR', ...(legacy ? {} : { paymentId: payment._id }) },
    disabled: false, onCheck: () => notified++,
  }); firstRender = false; return tree; };
  render();
  const cleanups = effects.map((effect) => effect()).filter(Boolean);
  return { render, payment, timers, revoked, socketEvents, pageEvents, advance: (ms) => { now += ms; }, cleanup: () => cleanups.forEach((cleanup) => cleanup()),
    get reconciliations() { return reconciliations; },
    get qrCalls() { return qrCalls; }, get notified() { return notified; } };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function elements(node, type) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, type));
  return typeof node === 'object' ? [...(node.type === type ? [node] : []), ...elements(node.props?.children, type)] : [];
}
async function run() {
  for (const legacy of [false, true]) {
    const app = harness({ legacy });
    await flush();
    const ready = app.render();
    assert.equal(elements(ready, 'img').length, 1, 'Hiển thị QR bằng ảnh ngay trong chat.');
    assert.equal(elements(ready, 'iframe').length, 0, 'Không phụ thuộc iframe PayOS.');
    assert.match(elements(ready, 'img')[0].props.src, /^blob:/);
    assert.equal(app.qrCalls, 1);
    const poll = [...app.timers.values()][0]; app.timers.clear(); poll(); await flush();
    assert.equal(app.qrCalls, 1, 'Polling không tạo hoặc tải lại QR liên tục.');
    app.payment.status = 'paid';
    [...app.timers.values()][0](); app.timers.clear(); await flush();
    assert.equal(elements(app.render(), 'img').length, 0, 'Ẩn QR sau khi backend xác nhận đã trả tiền.');
    assert.equal(app.notified, 1);
    app.cleanup();
    assert.equal(app.revoked.length, 1, 'Giải phóng URL ảnh khi đóng chat.');
  }
  const failed = harness({ qrFailure: true }); await flush();
  assert.equal(elements(failed.render(), 'img').length, 0);
  assert.equal(elements(failed.render(), 'button').length, 1, 'Có nút tải lại khi thiếu QR.');
  failed.cleanup();
  const closed = harness(); closed.cleanup(); await flush();
  assert.equal(closed.qrCalls, 0, 'Không tải ảnh khi component đã đóng.');
  assert.equal(closed.socketEvents.size, 0);
  assert.equal(closed.pageEvents.size, 0);
  const delayed = harness({ reconcilePaid: true }); await flush();
  delayed.advance(12000);
  [...delayed.timers.values()][0](); delayed.timers.clear(); await flush();
  assert.equal(delayed.reconciliations, 1, 'Chủ động đối soát khi webhook chưa cập nhật database.');
  assert.equal(delayed.notified, 1, 'Tự gửi xác nhận vào chat sau đối soát.');
  assert.equal(elements(delayed.render(), 'img').length, 0);
  delayed.cleanup();
  const realtime = harness(); await flush();
  realtime.socketEvents.get('payment:status')({ orderId: 'don-khac', paymentId: 'giao-dich' }); await flush();
  assert.equal(realtime.notified, 0, 'Bỏ qua tín hiệu của đơn khác.');
  realtime.payment.status = 'paid';
  realtime.socketEvents.get('payment:status')({ orderId: 'don-hang', paymentId: 'giao-dich' }); await flush();
  assert.equal(realtime.notified, 1, 'Socket xác minh ngay, không chờ nhịp polling.');
  realtime.cleanup();
  const focus = harness({ reconcilePaid: true }); await flush(); focus.advance(12000);
  focus.pageEvents.get('focus')(); await flush();
  assert.equal(focus.notified, 1, 'Quay lại tab tự đối soát và cập nhật chat.');
  focus.cleanup();
  console.log('Đã kiểm tra QR trong chat, phiên cũ, polling, ẩn QR sau thanh toán, lỗi và đóng chat.');
}
run().catch((error) => { console.error('Kiểm thử QR trong chat thất bại.', error); process.exitCode = 1; });
