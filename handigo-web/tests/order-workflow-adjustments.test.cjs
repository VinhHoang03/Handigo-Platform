const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
const cache = new Map();
function load(file) {
  const filename = path.join(root, file);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {}; cache.set(filename, exports);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, Number, URL, require(name) {
    if (name === '@/components/common/Toast') return { useToastFeedback: value => React.useState(value) };
    if (name === '@/components/common/ConfirmDialog') return { ConfirmDialog: () => null };
    if (name === '@/components/common/Modal') return { Modal: ({ open, children }) => open ? children : null };
    if (name === '@/components/common/ReliableImage') return { ReliableImage: () => null };
    if (name.endsWith('/RepairQuotationForm')) return { RepairQuotationForm: () => null };
    if (name.endsWith('/WalletBalanceText')) return { WalletBalanceText: () => null };
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const target = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate));
    if (!target) throw new Error(`Chưa tìm thấy module: ${name}`);
    return load(path.relative(root, target));
  } });
  return exports;
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const makeOrder = overrides => ({ _id: 'don-thu', status: 'accepted', inspectionRequired: false, orderType: 'normal',
  providerId: { _id: 'tho-thu' }, serviceId: { serviceType: 'fixed_price', name: 'Dịch vụ' },
  pricing: { totalPaidAmount: 120000 }, paymentMethod: 'cash', paymentStatus: 'unpaid', ...overrides });

test('Áp voucher chỉ có một dòng giảm tiền; danh sách không hiện mã code', () => {
  const { ConfirmPaymentVoucherPanel } = load('features/booking/components/ConfirmPaymentVoucherPanel.tsx');
  const { OrderSummaryPriceDetails } = load('features/booking/components/OrderSummaryPriceDetails.tsx');
  const voucher = { id: 'ma-thu', code: 'CODE_KHONG_HIEN', discountType: 'FIXED', discountValue: 10000 };
  const props = { availableVouchers: [voucher], appliedVoucher: voucher, voucherCode: voucher.code,
    voucherDiscountAmount: 10000, voucherError: '', isSubmitting: false };
  const html = render(OrderSummaryPriceDetails, { service: null, selectedOptions: [], total: 100000,
    finalTotal: 90000, discountAmount: 10000, summaryContent: React.createElement(ConfirmPaymentVoucherPanel, props) });
  assert.equal((html.match(/Giảm 10\.000đ/g) || []).length, 1);
  assert.doesNotMatch(html, /Đã giảm|CODE_KHONG_HIEN/);
  const list = render(ConfirmPaymentVoucherPanel, { ...props, appliedVoucher: null, voucherCode: '' });
  const optionTexts = [...list.matchAll(/<option[^>]*>(.*?)<\/option>/g)].map(match => match[1]).join(' ');
  assert.match(optionTexts, /Giảm 10\.000đ/); assert.doesNotMatch(optionTexts, /CODE_KHONG_HIEN/);
});

test('Lý do hủy phù hợp thời điểm đến nơi và loại lịch, khách không còn lý do mất liên lạc', () => {
  const { getProviderCancellationReasons } = load('features/provider/utils/providerOrder.utils.ts');
  const { getCustomerCancellationReasons } = load('features/booking/components/detail/bookingDetailConstants.ts');
  const order = makeOrder({ inspectionRequired: true });
  assert.equal(getProviderCancellationReasons(order).includes('Khách hàng không đồng ý báo giá'), false);
  assert.equal(getProviderCancellationReasons(order).includes('Lịch hẹn không còn phù hợp'), false);
  order.arrival = { providerId: 'tho-thu', arrivedAt: new Date().toISOString() };
  assert.equal(getProviderCancellationReasons(order).includes('Khách hàng không đồng ý báo giá'), true);
  assert.equal(getProviderCancellationReasons(order).includes('Không thể liên hệ với khách hàng'), false);
  assert.equal(getCustomerCancellationReasons(order).includes('Không liên hệ được với chuyên gia'), false);
  assert.equal(getCustomerCancellationReasons(order).includes('Chi phí không phù hợp'), false);
  order.orderType = 'scheduled'; order.arrival = null;
  assert.equal(getProviderCancellationReasons(order).includes('Lịch hẹn không còn phù hợp'), true);
});

test('Khách mất nút hủy ngay khi đúng thợ đến nơi, không phụ thuộc bộ đếm 5 phút', () => {
  const { BookingRefundPanel } = load('features/booking/components/detail/BookingRefundPanel.tsx');
  const order = makeOrder();
  const props = { order, busy: false, pendingAction: null, cancellationPreview: null, cancellationLocked: false };
  assert.match(render(BookingRefundPanel, props), /Hủy yêu cầu/);
  order.arrival = { providerId: 'tho-thu', arrivedAt: new Date().toISOString() };
  assert.doesNotMatch(render(BookingRefundPanel, props), /Hủy yêu cầu|Hủy buổi/);
});

test('Chỉ đơn cố định tiền mặt hoàn thành, chưa thu tiền mới có nút xác nhận đã thanh toán', () => {
  const { FixedPriceActionForm } = load('features/provider/components/FixedPriceActionForm.tsx');
  const order = makeOrder({ status: 'completed' });
  const props = { order, onConfirmCashPayment: async () => true };
  assert.match(render(FixedPriceActionForm, props), /Xác nhận đã thanh toán/);
  order.status = 'in_progress'; assert.doesNotMatch(render(FixedPriceActionForm, props), /Xác nhận đã thanh toán/);
  order.status = 'completed'; order.paymentMethod = 'bank';
  assert.doesNotMatch(render(FixedPriceActionForm, props), /Xác nhận đã thanh toán/);
  order.paymentMethod = 'cash'; order.paymentStatus = 'paid';
  const paid = render(FixedPriceActionForm, props);
  assert.match(paid, /Đã xác nhận nhận tiền mặt/); assert.doesNotMatch(paid, /<button[^>]*>Xác nhận đã thanh toán/);
});

test('Báo giá đã lưu không còn nút hủy, vẫn có chỉnh sửa và bắt đầu', () => {
  const { QuotationOrderPanel } = load('features/provider/components/orders/QuotationOrderPanel.tsx');
  const quotation = { quotation: { _id: 'bao-gia-thu', status: 'saved', finalAmount: 150000, createdAt: new Date().toISOString() }, items: [] };
  const order = makeOrder({ inspectionRequired: true, currentQuotationId: 'bao-gia-thu',
    arrival: { providerId: 'tho-thu', arrivedAt: new Date().toISOString() } });
  const html = render(QuotationOrderPanel, { order, quotation, busy: false, isUnconfirmedAppointment: false, showQuotationForm: false });
  assert.doesNotMatch(html, /Hủy đơn dịch vụ/); assert.match(html, /Chỉnh sửa báo giá|Bắt đầu làm việc/);
});

test('Ngày chứng chỉ kiểm tra ngày thực tế, ngày cấp tương lai và tài liệu hết hạn', () => {
  const { validateDateFields } = load('features/provider-application/utils/providerApplicationValidation.ts');
  assert.ok(validateDateFields('2023-02-29', '2099-01-01').issuedAt);
  assert.ok(validateDateFields('2024-02-30', '2099-01-01').issuedAt);
  assert.ok(validateDateFields('2098-01-01', '2099-01-01').issuedAt);
  assert.ok(validateDateFields('2024-02-29', '2020-01-01').expiresAt);
  assert.equal(Object.keys(validateDateFields('2024-02-29', '2099-01-01')).length, 0);
});
