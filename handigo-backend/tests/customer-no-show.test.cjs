const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

const now = Date.parse('2030-01-17T10:00:00+07:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function load(relative, modules) {
  const filename = path.join(__dirname, '../src', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date: Clock, Number, Math, require(name) {
    if (!(name in modules)) throw new Error(`Chưa giả lập module: ${name}`);
    return modules[name];
  } }, { filename });
  return exports;
}
const policy = load('utils/customerNoShow.ts', { '../utils/appError': { AppError }, './appError': { AppError } });
const providerId = new Types.ObjectId();
const waiting = (minutes = 10) => ({
  providerId, orderType: 'normal', arrival: { providerId, arrivedAt: new Date(now - minutes * 60000) },
});

test('Chặn khi thiếu mốc đến nơi hoặc mốc thuộc thợ trước', () => {
  assert.throws(() => policy.assertCustomerNoShowWait({ ...waiting(), arrival: null }), /xác nhận đã đến nơi/);
  assert.throws(() => policy.assertCustomerNoShowWait({ ...waiting(), providerId: new Types.ObjectId() }), /xác nhận đã đến nơi/);
});
test('Thời gian chờ 10 phút tuân theo cờ kiểm thử tạm thời', () => {
  if (policy.CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING) {
    assert.doesNotThrow(() => policy.assertCustomerNoShowWait(waiting(0)));
    assert.doesNotThrow(() => policy.assertCustomerNoShowWait(waiting(7)));
    return;
  }
  assert.throws(() => policy.assertCustomerNoShowWait(waiting(7)), /chờ thêm 3 phút/);
  assert.throws(() => policy.assertCustomerNoShowWait(waiting(), now - 1), /chờ thêm 1 phút/);
  assert.doesNotThrow(() => policy.assertCustomerNoShowWait(waiting()));
});
test('Mốc lịch hẹn tuân theo cờ kiểm thử; khi khôi phục tính đúng thời gian chờ', () => {
  const order = { ...waiting(60), orderType: 'scheduled', scheduledAt: new Date(now - 5 * 60000) };
  if (policy.CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING) {
    assert.doesNotThrow(() => policy.assertCustomerNoShowWait({ ...order, scheduledAt: new Date(now + 86400000) }));
    assert.doesNotThrow(() => policy.assertCustomerNoShowWait({ ...waiting(0), orderType: 'recurring', scheduledAt: new Date(now + 86400000) }));
    return;
  }
  assert.throws(() => policy.assertCustomerNoShowWait(order), /chờ thêm 5 phút/);
  assert.doesNotThrow(() => policy.assertCustomerNoShowWait(order, now + 5 * 60000));
  assert.throws(() => policy.assertCustomerNoShowWait({ ...waiting(3), orderType: 'recurring', scheduledAt: new Date(now - 3600000) }), /chờ thêm 7 phút/);
});

const query = value => ({
  session() { return this; }, sort() { return this; }, lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});
function setup(overrides = {}, options = {}) {
  const provider = { _id: providerId, userId: new Types.ObjectId(), availabilityStatus: options.availability ?? 'busy' };
  const reports = [], notifications = [];
  const order = { ...waiting(), _id: new Types.ObjectId(), customerId: new Types.ObjectId(), orderCode: 'HD-THU-NGHIEM',
    status: 'accepted', addressSnapshot: { latitude: 10.8, longitude: 106.7 },
    async save() {}, ...overrides };
  const location = { coordinates: { coordinates: options.coordinates ?? [106.7, 10.8] }, lastUpdatedAt: new Date(now - (options.locationAge ?? 0)) };
  const modules = {
    mongoose: { __esModule: true, Types, default: { startSession: async () => ({ endSession: async () => {} }) } },
    '../models/order.model': { Order: {
      findById: () => query(order),
      exists: () => query(options.otherWork ?? false),
      findOne(filter) { return query(!filter.providerId || String(filter.providerId) === String(order.providerId) ? order : null); },
      async findOneAndUpdate(_, update) { Object.assign(order, update.$set); return order; },
    } },
    '../models/provider.model': { Provider: {
      findOne: () => query(options.noProvider ? null : provider),
      async updateOne(filter, update) {
        if (provider.availabilityStatus === filter.availabilityStatus) Object.assign(provider, update.$set);
      },
    } },
    '../models/address.model': { Address: { findOne: () => query(null) } },
    '../models/location.model': { Location: { findOne: () => query(options.noLocation ? null : location) } },
    '../models/report.model': { Report: {
      findById: id => query(reports.find(report => String(report._id) === String(id)) ?? null),
      async updateOne() {},
      findOne: filter => query(reports.find(report => String(report._id) === String(filter._id)) ?? null),
      async create(items) { const report = { _id: new Types.ObjectId(), status: 'pending', async save() {}, ...items[0] }; reports.push(report); return [report]; },
    } },
    '../utils/appError': { AppError }, '../utils/transaction': { withTransactionRetry: async (_, fn) => fn() },
    '../utils/logger': { createLogger: () => ({ error() {} }) },
    './matching.service': { haversineMeters: (a, b, c, d) => a === c && b === d ? 0 : 1000 },
    './providerSchedule.service': { lockProviderSchedule: async () => provider },
    './notification.service': { createNotificationRecord: async item => notifications.push(item) },
    '../sockets/socketServer': { emitToUser() {} }, '../utils/customerNoShow': policy,
    './orderCancellation.service': { async cancelOrderWithSettlement() {
      if (options.autoFails) throw new Error('Dữ liệu thay đổi');
      order.status = 'cancelled'; order.customerNoShow.status = 'approved'; return order;
    } },
    '../utils/orderActorContext': { orderActorContext: { exit: fn => fn() } },
    './customerNoShowVerification.service': {
      getNoShowEvidence: async (_, userId, arrivalIds, contactIds) => [...arrivalIds, ...contactIds].map(id => ({ _id: new Types.ObjectId(id), url: `https://example.com/${id}.jpg` })),
      verifyNoShowEvidence: async () => ({ decision: options.autoEligible ? 'auto_eligible' : 'manual_review', reasons: ['Kết quả kiểm tra'], checkedAt: new Clock(), policyVersion: 'THU-NGHIEM' }),
      storeNoShowEvidence: async () => ({}),
    },
  };
  modules['./providerPresence.service'] = load('services/providerPresence.service.ts', modules);
  const service = load('services/customerNoShow.service.ts', modules);
  return { ...service, order, provider, reports, notifications, userId: String(provider.userId) };
}
test('Xác nhận đến nơi ghi giờ máy chủ, báo khách và không đặt lại giờ khi bấm lần hai', async () => {
  const ctx = setup({ arrival: null });
  await ctx.markOrderArrival(String(ctx.order._id), ctx.userId);
  assert.equal(+ctx.order.arrival.arrivedAt, now);
  assert.equal(ctx.notifications.length, 1);
  await ctx.markOrderArrival(String(ctx.order._id), ctx.userId);
  assert.equal(ctx.notifications.length, 1);
});
for (const [name, options, message] of [
  ['vị trí cũ', { locationAge: 120001 }, /cập nhật vị trí/],
  ['xa địa chỉ', { coordinates: [105, 10] }, /200 m/],
  ['thiếu vị trí', { noLocation: true }, /cập nhật vị trí/],
]) {
  test(`Không xác nhận đến nơi khi ${name}`, async () => {
    const ctx = setup({ arrival: null }, options);
    await assert.rejects(ctx.markOrderArrival(String(ctx.order._id), ctx.userId), message);
    assert.equal(ctx.notifications.length, 0);
  });
}
test('Chặn thao tác trên đơn của thợ khác và đơn đã bắt đầu', async () => {
  const foreign = setup({ providerId: new Types.ObjectId() });
  await assert.rejects(foreign.checkCustomerNoShowEligibility(String(foreign.order._id), foreign.userId), /Không tìm thấy/);
  const active = setup({ status: 'in_progress' });
  await assert.rejects(active.checkCustomerNoShowEligibility(String(active.order._id), active.userId), /chưa bắt đầu/);
});
test('Đủ thời gian tạo báo cáo trong module quản trị, chỉ một lần và không hoàn thành đơn', async () => {
  const ctx = setup();
  const payload = { description: 'Đã gọi và nhắn tin nhưng khách không trả lời.', arrivalEvidenceIds: [String(new Types.ObjectId())], contactEvidenceIds: [String(new Types.ObjectId())], contactedCustomer: true };
  await ctx.reportCustomerNoShow(String(ctx.order._id), ctx.userId, payload);
  assert.equal(ctx.reports.length, 1);
  assert.equal(ctx.reports[0].isCustomerNoShow, true);
  assert.equal(ctx.order.customerNoShow.compensationAmount, 5000);
  assert.equal(ctx.order.customerNoShow.status, 'pending');
  assert.equal(ctx.order.status, 'accepted');
  assert.equal(ctx.provider.availabilityStatus, 'online');
  await assert.rejects(ctx.reportCustomerNoShow(String(ctx.order._id), ctx.userId, payload), /đã có báo cáo/);
  assert.equal(ctx.reports.length, 1);
});

for (const [options, expected] of [
  [{}, 'online'], [{ otherWork: true }, 'busy'], [{ availability: 'offline' }, 'offline'],
]) {
  test(`Gửi báo cáo giải phóng thợ đúng trạng thái khi ${JSON.stringify(options)}`, async () => {
    const ctx = setup({}, options);
    await ctx.reportCustomerNoShow(String(ctx.order._id), ctx.userId, {
      description: 'Đã gọi và nhắn tin nhưng khách không trả lời.',
      arrivalEvidenceIds: [String(new Types.ObjectId())], contactEvidenceIds: [String(new Types.ObjectId())], contactedCustomer: true,
    });
    assert.equal(ctx.provider.availabilityStatus, expected);
    assert.equal(ctx.order.customerNoShow.status, 'pending');
    assert.equal(ctx.reports[0].status, 'pending');
  });
}
test('Validation yêu cầu xác nhận liên hệ, mô tả và ảnh; không nhận số tiền từ client', () => {
  const { customerNoShowSchema } = load('validations/order.validator.ts', { zod: require('zod') });
  const payload = { description: 'Không liên hệ được khách.', arrivalEvidenceIds: [String(new Types.ObjectId())], contactEvidenceIds: [String(new Types.ObjectId())], contactedCustomer: true, compensationAmount: 999999 };
  assert.equal(customerNoShowSchema.safeParse({ ...payload, contactedCustomer: false }).success, false);
  assert.equal(customerNoShowSchema.safeParse({ ...payload, contactEvidenceIds: [] }).success, false);
  assert.equal(customerNoShowSchema.safeParse({ ...payload, arrivalEvidenceIds: [] }).success, false);
  assert.equal(customerNoShowSchema.safeParse({ ...payload, contactEvidenceIds: payload.arrivalEvidenceIds }).success, false);
  assert.equal(customerNoShowSchema.safeParse({ ...payload, description: 'ngắn' }).success, false);
  assert.equal(customerNoShowSchema.parse(payload).compensationAmount, undefined);
  assert.equal(customerNoShowSchema.parse({ ...payload, automated: true }).automated, undefined);
});

test('Quản trị viên xem xét rồi từ chối: đồng bộ kết quả đơn, thông báo và không cho mở lại báo cáo đã xử lý', async () => {
  const ctx = setup();
  await ctx.reportCustomerNoShow(String(ctx.order._id), ctx.userId, {
    description: 'Đã gọi và nhắn tin nhưng khách không trả lời.', arrivalEvidenceIds: [String(new Types.ObjectId())], contactEvidenceIds: [String(new Types.ObjectId())], contactedCustomer: true,
  });
  const reportId = String(ctx.reports[0]._id), adminId = String(new Types.ObjectId());
  await ctx.reviewCustomerNoShowReport(reportId, adminId, { status: 'under_review' });
  assert.equal(ctx.reports[0].status, 'under_review');
  assert.equal(ctx.order.customerNoShow.status, 'pending');
  await assert.rejects(ctx.reviewCustomerNoShowReport(reportId, adminId, { status: 'rejected' }), /lý do từ chối/);
  await ctx.reviewCustomerNoShowReport(reportId, adminId, { status: 'rejected', resolutionNote: 'Bằng chứng chưa phù hợp với thông tin khách cung cấp.' });
  assert.equal(ctx.reports[0].status, 'rejected');
  assert.equal(ctx.order.customerNoShow.status, 'rejected');
  assert.equal(ctx.order.status, 'accepted');
  assert.equal(ctx.notifications.length, 4);
  await assert.rejects(ctx.reviewCustomerNoShowReport(reportId, adminId, { status: 'under_review' }), /đã có kết quả/);
});

test('Báo cáo đủ điều kiện được chuyển tự duyệt; lỗi tự duyệt vẫn giữ báo cáo cho admin', async () => {
  for (const autoFails of [false, true]) {
    const ctx = setup({}, { autoEligible: true, autoFails });
    await ctx.reportCustomerNoShow(String(ctx.order._id), ctx.userId, {
      description: 'Đã gọi và nhắn tin nhưng khách không trả lời.', arrivalEvidenceIds: [String(new Types.ObjectId())], contactEvidenceIds: [String(new Types.ObjectId())], contactedCustomer: true,
    });
    assert.equal(ctx.order.customerNoShow.status, autoFails ? 'pending' : 'approved');
    assert.equal(ctx.order.status, autoFails ? 'accepted' : 'cancelled');
    assert.equal(ctx.order.customerNoShow.evidenceIds.length, 2);
    assert.equal(ctx.provider.availabilityStatus, 'online');
  }
});

test('Đã lưu báo giá thì không nhận thêm báo cáo khách vắng mặt', async () => {
  const ctx = setup({ currentQuotationId: new Types.ObjectId() });
  await assert.rejects(ctx.checkCustomerNoShowEligibility(String(ctx.order._id), ctx.userId), /đã lưu báo giá/);
});
