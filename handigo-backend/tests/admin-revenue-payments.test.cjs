const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function validator(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, Date, require(name) { return name === './adminDashboard.validator' ? validator(path.join(path.dirname(file), 'adminDashboard.validator.ts')) : require(name); } });
  return exports;
}
const { paymentHistoryQuerySchema } = validator(path.join(__dirname, '../src/validations/payment.validator.ts'));
const source = fs.readFileSync(path.join(__dirname, '../src/services/payment.service.ts'), 'utf8');
const start = source.indexOf('export const getPaymentHistory =');
const body = source.slice(start, source.indexOf('\nexport const ', start + 1));

test('Bộ lọc thanh toán kiểm tra ngày và chuyển ranh giới theo giờ Việt Nam', () => {
  const result = paymentHistoryQuerySchema.parse({ fromDate: '2026-10-01', toDate: '2026-10-31', dateField: 'paidAt' });
  assert.equal(result.fromDate.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(result.toDate.toISOString(), '2026-10-31T16:59:59.999Z');
  for (const query of [{ fromDate: '2026-02-30' }, { dateField: 'customerId' }, { fromDate: '2026-10-31', toDate: '2026-10-01' }]) assert.equal(paymentHistoryQuerySchema.safeParse(query).success, false);
});

test('Báo cáo doanh thu và tổng quan dùng cùng ranh giới ngày với bảng giao dịch', () => {
  const { adminOperationsQuerySchema } = validator(path.join(__dirname, '../src/validations/dashboard.validator.ts'));
  const input = { fromDate: '2026-10-01', toDate: '2026-10-31' };
  const report = adminOperationsQuerySchema.parse(input);
  const payments = paymentHistoryQuerySchema.parse(input);
  assert.equal(report.fromDate.toISOString(), payments.fromDate.toISOString());
  assert.equal(report.toDate.toISOString(), payments.toDate.toISOString());
});

test('Mã đơn bổ sung cho lịch sử quản trị không thay đổi orderId', async () => {
  const payment = { orderId: 'order1', amount: 200000, toObject() { return { orderId: this.orderId, amount: this.amount }; } };
  const chain = { sort() { return this; }, skip() { return this; }, limit() { return Promise.resolve([payment]); } };
  const Payment = { find() { return chain; }, countDocuments() { return Promise.resolve(3); }, aggregate() { return Promise.resolve([{ total: 1 }]); } };
  const Order = { find() { return { select() { return { lean() { return Promise.resolve([{ _id: 'order1', orderCode: 'ORD-01' }]); } }; } }; } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Payment, Order });
  const result = await exports.getPaymentHistory({ id: 'admin', role: 'ADMIN' }, paymentHistoryQuerySchema.parse({}));
  assert.equal(result.items[0].orderId, 'order1');
  assert.equal(result.items[0].orderCode, 'ORD-01');
  assert.equal(result.totalOrders, 1);
  assert.equal(result.pagination.total, 3);
});

test('Phí nền tảng chỉ lấy giao dịch thành công; tiền thu ròng trừ đúng tiền hoàn', async () => {
  const pipelines = [];
  function model(name) { return { async aggregate(pipeline) {
    pipelines.push({ name, pipeline });
    const match = pipeline[0].$match;
    if (pipeline[1].$group?._id !== null) return [];
    const total = name === 'WalletTransaction' ? match.type === 'platform_fee' ? 150000 : 850000
      : match.status === 'refunded' ? 25000 : match.paymentType === 'inspection_deposit' ? 50000 : 200000;
    return [{ total }];
  } }; }
  const Payment = model('Payment');
  const WalletTransaction = model('WalletTransaction');
  const exports = {};
  const service = fs.readFileSync(path.join(__dirname, '../src/services/dashboard.service.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(service, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date, require(name) {
    if (name.includes('walletTransaction.model')) return { WalletTransaction };
    if (name.includes('payment.model')) return { Payment };
    return {};
  } });
  const query = paymentHistoryQuerySchema.parse({ fromDate: '2026-10-01', toDate: '2026-10-31' });
  const result = await exports.getAdminRevenue(query);
  assert.equal(result.platformFeeRevenue, 150000);
  assert.equal(result.netCollectedPaymentRevenue, 175000);
  const fee = pipelines.find(({ name, pipeline }) => name === 'WalletTransaction' && pipeline[0].$match.type === 'platform_fee').pipeline[0].$match;
  assert.equal(fee.status, 'success');
  assert.equal(fee.direction, 'out');
  assert.equal(fee.isDeleted, false);
  assert.equal(fee.createdAt.$gte, query.fromDate);
  for (const { pipeline } of pipelines.filter(item => item.pipeline[1].$group?._id?.$dateToString)) {
    assert.equal(pipeline[1].$group._id.$dateToString.timezone, 'Asia/Ho_Chi_Minh');
  }
});

test('Bảng thu tiền gồm cả khoản đã hoàn, lọc trước phân trang và giữ quyền sở hữu khách', async () => {
  let filter, sort;
  const chain = { sort(value) { sort = value; return this; }, skip() { return this; }, limit() { return Promise.resolve([]); } };
  const Payment = { find(value) { filter = value; return chain; }, countDocuments() { return Promise.resolve(0); }, aggregate(pipeline) {
    assert.deepEqual(pipeline[0].$match, filter);
    assert.equal(pipeline[1].$group._id, '$orderId');
    assert.equal(pipeline[2].$count, 'total');
    return Promise.resolve([]);
  } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Payment });
  const query = paymentHistoryQuerySchema.parse({ fromDate: '2026-10-01', toDate: '2026-10-31', dateField: 'paidAt' });
  await exports.getPaymentHistory({ id: 'admin', role: 'ADMIN' }, query);
  assert.deepEqual(JSON.parse(JSON.stringify(filter.status)), { $in: ['paid', 'refunded'] });
  assert.equal(filter.paidAt.$gte, query.fromDate);
  assert.equal(filter.isDeleted, false);
  assert.equal(sort.paidAt, -1);
  await exports.getPaymentHistory({ id: 'customer1', role: 'CUSTOMER' }, { ...query, dateField: 'refundedAt' });
  assert.equal(filter.customerId, 'customer1');
  assert.equal(filter.status, 'refunded');
  assert.equal(filter.refundedAt.$lte, query.toDate);
  await exports.getPaymentHistory({ id: 'customer1', role: 'CUSTOMER' }, paymentHistoryQuerySchema.parse({}));
  assert.deepEqual(Object.keys(filter), ['customerId']);
});
