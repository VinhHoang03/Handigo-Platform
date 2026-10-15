const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.join(__dirname, '../src');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  cache.set(filename, exports);
  vm.runInNewContext(code, { exports, Intl, Date, Number, Math, require(name) {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const dependency = ['.ts', '.tsx'].map(extension => base + extension).find(file => fs.existsSync(file));
    if (!dependency) throw new Error(`Không tìm thấy module: ${name}`);
    return load(dependency);
  } }, { filename });
  return exports;
}

const { PaymentSummaryCard } = load(path.join(sourceRoot, 'features/provider/components/orders/PaymentSummaryCard.tsx'));
function makeOrder(overrides = {}) {
  return { status: 'accepted', paymentMethod: 'cash', paymentStatus: 'unpaid', inspectionRequired: false,
    serviceId: { serviceType: 'fixed_price' }, pricing: { bookingAmount: 120000, baseAmount: 120000,
      totalPaidAmount: 120000, promotionDiscountAmount: 0, voucherDiscountAmount: 0,
      platformCommissionAmount: 12000, providerEarningAmount: 108000 }, ...overrides };
}
function render(order, quotation = null, paymentStatus = 'Chưa thanh toán') {
  return renderToStaticMarkup(React.createElement(PaymentSummaryCard, { order, quotation, paymentStatus }));
}
function value(html, label) {
  const match = html.match(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>(.*?)</dd>`));
  assert.ok(match, `Thiếu dòng ${label}`);
  return match[1].replace(/\s/g, '');
}

test('Đơn tiền mặt: hiển thị thông tin thanh toán, không hiển thị thu nhập', () => {
  const html = render(makeOrder());
  assert.equal(value(html, 'Trạng thái thanh toán'), 'Chưathutiền');
  assert.equal(value(html, 'Giá trị dịch vụ'), '120.000₫');
  assert.equal(value(html, 'Tổng tiền khách phải trả'), '120.000₫');
  assert.doesNotMatch(html, /Thu nhập của thợ|Thu nhập dự kiến|Tiền công trước phí|Phí nền tảng/);
  assert.doesNotMatch(html, />Giảm giá</);
  assert.doesNotMatch(html, /bg-success-container|Bồi thường phí hủy/);
});

test('Có giảm giá: phân biệt giá trước giảm và tổng sau giảm', () => {
  const order = makeOrder();
  Object.assign(order.pricing, { voucherDiscountAmount: 12000, totalPaidAmount: 108000,
    platformCommissionAmount: 9000, providerEarningAmount: 99000 });
  const html = render(order);
  assert.equal(value(html, 'Giá trị dịch vụ'), '120.000₫');
  assert.equal(value(html, 'Giảm giá'), '-12.000₫');
  assert.equal(value(html, 'Tổng tiền khách phải trả'), '108.000₫');
});

test('Ví/QR đã trả tiền: giữ trạng thái đã thanh toán và nhắc không thu thêm tiền mặt', () => {
  for (const paymentMethod of ['wallet', 'bank']) {
    const html = render(makeOrder({ paymentMethod, paymentStatus: 'paid' }), null, 'Đã thanh toán');
    assert.equal(value(html, 'Trạng thái thanh toán'), 'Đãthanhtoán');
    assert.match(html, /Không thu thêm tiền mặt từ khách/);
  }
});

test('Đơn hoàn tất và đã hủy đều không hiển thị phần thu nhập', () => {
  const completed = render(makeOrder({ status: 'completed', paymentStatus: 'paid' }));
  assert.doesNotMatch(completed, /Thu nhập/);
  assert.equal(value(completed, 'Trạng thái thanh toán'), 'Đãthutiềnmặt');
  const cancelled = render(makeOrder({ status: 'cancelled' }));
  assert.doesNotMatch(cancelled, /Thu nhập của thợ|Thu nhập dự kiến/);
});

test('Đơn báo giá: để trống khi chưa có giá, tách tiền cọc khỏi tiền sửa chữa', () => {
  const order = makeOrder({ inspectionRequired: true, serviceId: { serviceType: 'variable_price' },
    paymentMethod: 'bank', paymentStatus: 'partially_paid', depositPaidAt: '2026-10-15T01:00:00Z' });
  order.pricing.totalPaidAmount = 30000;
  const empty = render(order, null, 'Đã thanh toán tiền cọc');
  assert.equal(value(empty, 'Giá trị đơn hàng'), '');
  assert.equal(value(empty, 'Tiền cọc đã thanh toán'), '30.000₫');
  assert.doesNotMatch(empty, /Thu nhập dự kiến|Chưa báo giá/);
  const quotation = { quotation: { finalAmount: 150000, status: 'saved' } };
  const quoted = render(order, quotation, 'Đã thanh toán tiền cọc');
  assert.equal(value(quoted, 'Giá trị đơn hàng'), '150.000₫');
  assert.equal(value(quoted, 'Cọc được khấu trừ'), '-30.000₫');
  assert.equal(value(quoted, 'Còn cần thu trực tiếp'), '120.000₫');
  assert.doesNotMatch(quoted, /Thu nhập của thợ|Thu nhập dự kiến/);
  assert.doesNotMatch(quoted, />Phí nền tảng</);
});
