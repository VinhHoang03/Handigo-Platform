const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

// Chạy service thật với database giả lập, không kết nối máy chủ hoặc đọc bí mật.
function setup({ existing = false, owned = true, auditFails = false } = {}) {
  const providerUser = new Types.ObjectId().toString();
  const provider = { _id: new Types.ObjectId(), get id() { return String(this._id); } };
  const events = [];
  let committed = false;
  const query = value => ({
    select() { return this; }, lean() { return this; }, session() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  const session = {
    async withTransaction(fn) { const value = await fn(); committed = true; return value; },
    async endSession() {},
  };
  class Quotation {
    constructor(values) { Object.assign(this, { _id: new Types.ObjectId(), status: 'saved', revision: 1, finalAmount: 200000 }, values); }
    get id() { return String(this._id); }
    set(values) { Object.assign(this, values); }
    toObject() { return { ...this }; }
    async save() {}
  }
  const order = {
    _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: owned ? provider._id : new Types.ObjectId(),
    serviceId: new Types.ObjectId(), status: 'accepted', orderType: 'immediate', inspectionRequired: true,
    depositAmount: 50000, depositPaidAt: new Date(), confirmation: {}, pricing: { totalPaidAmount: 50000 },
    get id() { return String(this._id); }, async save() {},
  };
  const quotation = new Quotation({ orderId: order._id, customerId: order.customerId, providerId: provider._id });
  if (existing) order.currentQuotationId = quotation._id;
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    crypto: require('node:crypto'),
    '../models/order.model': { Order: { findOne: () => query(order), updateOne: () => query({ matchedCount: 1 }) } },
    '../models/provider.model': { Provider: { findOne: () => query(provider) } },
    '../models/service.model': { Service: { findById: () => query({ serviceType: 'variable_price' }) } },
    '../models/repairQuotation.model': { RepairQuotation: Object.assign(Quotation, { findOne: () => query(quotation) }) },
    '../models/repairQuotationItem.model': { RepairQuotationItem: {
      find: () => query([]), updateMany: async () => {},
      insertMany: async items => items.map(item => ({ toObject: () => item })),
    } },
    '../models/payment.model': { Payment: { exists: () => query(false) } },
    '../models/auditLog.model': { AuditLog: { create: async () => { if (auditFails) throw Error('Lỗi lưu kiểm thử'); } } },
    '../utils/appError': { AppError: class extends Error {} },
    '../utils/logger': { createLogger: () => ({ warn() {} }) },
    './systemConfig.service': { getBookingPolicy: async () => ({}) },
    './providerSchedule.service': { lockProviderSchedule: async () => {} },
    './reward.service': { earnOrderRewards: async () => {} },
    './notification.service': { createNotificationRecord: async () => ({}), emitRealtimeNotification() {} },
    '../sockets/socketServer': { emitToUser: (userId, name, payload) => {
      assert.equal(committed, true, 'Chỉ phát sau khi transaction đã thành công');
      events.push({ userId, name, payload });
    } },
  };
  const filename = path.join(__dirname, '../src/services/assignment.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, require: name => modules[name] ?? {} }, { filename });
  const payload = { orderId: order.id, items: [{ title: 'Thay gas', itemType: 'labor', quantity: 1, unitPrice: 200000 }] };
  return { service: exports.AssignmentService, events, order, quotation, providerUser, payload };
}

function assertRecipients(ctx) {
  assert.equal(ctx.events.length, 2);
  assert.deepEqual(ctx.events.map(event => event.userId).sort(), [String(ctx.order.customerId), ctx.providerUser].sort());
  for (const event of ctx.events) {
    assert.equal(event.name, 'quotation:updated');
    assert.equal(event.payload.orderId, ctx.order.id);
    assert.equal(typeof event.payload.revision, 'number');
    assert.deepEqual(Object.keys(event.payload).sort(), ['orderId', 'revision']);
  }
}

for (const existing of [false, true]) {
  test(`${existing ? 'Sửa' : 'Tạo'} báo giá báo cho khách và tất cả thiết bị của đúng thợ sau commit`, async () => {
    const ctx = setup({ existing });
    if (existing) await ctx.service.updateRepairQuotation({ ...ctx.payload, quotationId: ctx.quotation.id, expectedRevision: 1 }, ctx.providerUser);
    else await ctx.service.createRepairQuotation(ctx.payload, ctx.providerUser);
    assertRecipients(ctx);
  });
}

test('Xác nhận thu trực tiếp cũng cập nhật các thiết bị của thợ', async () => {
  const ctx = setup({ existing: true });
  ctx.order.status = 'completed';
  await ctx.service.confirmQuotationPayment(ctx.order.id, ctx.providerUser, ctx.quotation.id, 1);
  assertRecipients(ctx);
});

test('Sai quyền hoặc transaction thất bại không phát thay đổi báo giá', async () => {
  for (const options of [{ owned: false }, { auditFails: true }]) {
    const ctx = setup(options);
    await assert.rejects(ctx.service.createRepairQuotation(ctx.payload, ctx.providerUser));
    assert.deepEqual(ctx.events, []);
  }
});
