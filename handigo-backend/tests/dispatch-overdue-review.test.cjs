const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const { Types } = require('mongoose');

// Chạy bộ quét thật với collection giả lập quy tắc cập nhật trường lồng của MongoDB.
function setup(overdueReview, { race = false, failOverdueScan = false, failFirstMatchingScan = false, pendingAssignment = false, expiredReplacement = false } = {}) {
  const order = { _id: new Types.ObjectId(), orderCode: 'ORD-OVERDUE', customerId: new Types.ObjectId(), providerId: new Types.ObjectId(), status: 'in_progress', isDeleted: false };
  if (overdueReview !== undefined) order.overdueReview = overdueReview;
  const stalledOrder = { _id: new Types.ObjectId(), status: 'created',
    preferredProviderId: expiredReplacement ? null : new Types.ObjectId(),
    ...(expiredReplacement ? { matchingSearch: { expiresAt: new Date(0) } } : {}) };
  const notifications = [], errors = [], updates = [], phases = [], recoveries = [], cancellations = [];
  const connection = new EventEmitter();
  const timers = new Set();
  const assignments = pendingAssignment ? [{
    _id: new Types.ObjectId(), orderId: order._id, providerId: order.providerId,
    responseDeadline: new Date(Date.now() + 60_000),
  }] : [];
  const chain = value => ({ select() { return this; }, limit() { return this; }, sort() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
  const modules = {
    mongoose: { Types, connection },
    '../models/order.model': { Order: {
      findById: id => chain(String(id) === String(stalledOrder._id)
        ? stalledOrder : { ...order, addressSnapshot: {}, serviceId: new Types.ObjectId() }),
      find(filter) {
        if (filter.matchingStartedAt?.$ne === null) {
          if (failFirstMatchingScan) {
            failFirstMatchingScan = false;
            throw new Error('MongoDB tạm thời chưa sẵn sàng');
          }
          return chain([stalledOrder]);
        }
        phases.push('continue-scan');
        return chain([]);
      },
      async updateOne(filter) { recoveries.push(filter._id.toString()); },
      async updateMany() {},
      async findOneAndUpdate(filter, update, options) {
        updates.push({ filter, update, options });
        if (race) order.overdueReview = { escalatedAt: new Date('2026-10-24T00:00:00Z') };
        if (order.overdueReview?.escalatedAt || order.isDeleted || order.status !== 'in_progress') return null;
        if (update.$set['overdueReview.escalatedAt'] && order.overdueReview === null) {
          throw new Error("Cannot create field 'escalatedAt' in element {overdueReview: null}");
        }
        if (update.$set.overdueReview) order.overdueReview = update.$set.overdueReview;
        else order.overdueReview = { ...order.overdueReview, escalatedAt: update.$set['overdueReview.escalatedAt'] };
        return order;
      },
    } },
    '../models/orderAssignment.model': { OrderAssignment: { find: () => chain(assignments), exists: async () => false } },
    '../models/provider.model': { Provider: { findById: () => chain({ userId: new Types.ObjectId() }) } },
    '../models/user.model': { __esModule: true, default: { find: () => chain([{ _id: new Types.ObjectId() }]) } },
    './systemConfig.service': { getNumberConfigValue: async (_, fallback) => fallback, getBookingPolicy: async () => ({}) },
    './providerSchedule.service': { getOrderInterval: () => ({ start: 0, end: 60_000, travelMinutes: 0 }) },
    './orderDeadline.service': { recoverOrderDeadlines: async () => 0, stopOrderDeadlines() {} },
    './orderReassignment.service': { expirePendingReassignments: async () => 0 },
    './orderCancellation.service': { cancelSystemOrderWithSettlement: async (...args) => cancellations.push(args) },
    './orderOverdue.service': { findOverdueOrders: async () => {
      if (failOverdueScan) throw new Error('Không thể truy vấn đơn đang thực hiện');
      return order.overdueReview?.escalatedAt ? [] : [order];
    } },
    './notification.service': { createNotificationRecord: async payload => notifications.push(payload) },
    '../utils/logger': { createLogger: () => ({ error: (...args) => errors.push(args), debug() {} }) },
  };
  const file = path.join(__dirname, '../src/services/dispatch.service.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date, Map, Set, require: name => modules[name] ?? {},
    setTimeout: (callback, delay) => {
      const timer = { callback, delay, unref() {} };
      timers.add(timer);
      return timer;
    },
    clearTimeout: timer => timers.delete(timer),
  }, { filename: file });
  async function drain() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
  exports.DispatchService.dispatchReadyOrder = async () => {};
  return { service: exports.DispatchService, order, errors, notifications, updates, phases, recoveries, timers, cancellations, reconnect: async () => { connection.emit('reconnected'); await drain(); } };
}

test('Nút quét chờ xử lý hủy đơn tìm thợ thay thế đã hết hạn', async () => {
  const ctx = setup(null, { expiredReplacement: true });
  assert.equal((await ctx.service.scanOrders()).failed, 0);
  assert.equal(ctx.cancellations.length, 1);
  assert.equal(ctx.cancellations[0][2], 'provider_unavailable');
});

for (const [label, value] of [['null', null], ['thiếu trường', undefined], ['object rỗng', {}], ['escalatedAt null', { escalatedAt: null }]]) {
  test(`Quét đơn overdueReview ${label} không lỗi, gửi đủ thông báo và tiếp tục quét`, async () => {
    const ctx = setup(value);
    await ctx.service.scanOrders();
    assert.equal(ctx.errors.length, 0);
    assert.ok(ctx.order.overdueReview.escalatedAt instanceof Date);
    assert.equal(ctx.notifications.length, 3);
    assert.ok(ctx.phases.length > 0);
    assert.equal(ctx.updates[0].options.runValidators, true);
    assert.equal(ctx.updates[0].filter.isDeleted, false);
    await ctx.service.scanOrders();
    assert.equal(ctx.notifications.length, 3);
  });
}

test('Đơn đã đánh dấu quá hạn giữ nguyên thời điểm, không gửi lại thông báo', async () => {
  const marked = new Date('2026-10-24T10:00:00Z');
  const ctx = setup({ escalatedAt: marked });
  await ctx.service.scanOrders();
  assert.equal(ctx.order.overdueReview.escalatedAt, marked);
  assert.equal(ctx.notifications.length, 0);
  assert.equal(ctx.updates.length, 0);
});

test('Hai lượt quét cạnh tranh không ghi đè dấu mốc hoặc gửi thông báo trùng', async () => {
  const ctx = setup(null, { race: true });
  await ctx.service.scanOrders();
  assert.equal(ctx.notifications.length, 0);
  assert.equal(ctx.order.overdueReview.escalatedAt.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(ctx.errors.length, 0);
});

test('Lỗi kiểm tra đơn đang thực hiện vẫn cho phép khôi phục đơn chờ thợ', async () => {
  const ctx = setup(null, { failOverdueScan: true });
  const scan = ctx.service.scanOrders();
  assert.equal(scan, ctx.service.scanOrders());
  assert.equal((await scan).failed, 1);
  assert.equal(ctx.errors.length, 1);
  assert.equal(ctx.recoveries.length, 1);
});

test('Chỉ quét khi được gọi và có thể quét lại sau lỗi truy vấn', async () => {
  const ctx = setup(null, { failFirstMatchingScan: true });
  await ctx.reconnect();
  assert.equal(ctx.updates.length, 0);
  await assert.rejects(ctx.service.scanOrders(), /MongoDB tạm thời chưa sẵn sàng/);
  assert.equal(ctx.recoveries.length, 0);
  await ctx.service.scanOrders();
  assert.equal(ctx.recoveries.length, 1);
});

test('Khôi phục hẹn giờ nhận đơn chưa hết hạn và không tạo hẹn giờ trùng khi quét lại', async () => {
  const ctx = setup(null, { pendingAssignment: true });
  await ctx.service.scanOrders();
  assert.equal(ctx.errors.length, 0);
  assert.equal(ctx.timers.size, 1);
  assert.ok([...ctx.timers][0].delay > 0);
  await ctx.service.scanOrders();
  assert.equal(ctx.timers.size, 1);
  ctx.service.stopTimeoutMonitor();
  assert.equal(ctx.timers.size, 0);
});
