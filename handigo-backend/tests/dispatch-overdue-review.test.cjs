const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

// Chạy bộ quét thật với collection giả lập quy tắc cập nhật trường lồng của MongoDB.
function setup(overdueReview, race = false) {
  const order = { _id: new Types.ObjectId(), orderCode: 'ORD-OVERDUE', customerId: new Types.ObjectId(), providerId: new Types.ObjectId(), status: 'in_progress', isDeleted: false };
  if (overdueReview !== undefined) order.overdueReview = overdueReview;
  const notifications = [], errors = [], updates = [], phases = [];
  let periodic;
  const chain = value => ({ select() { return this; }, limit() { return this; }, sort() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
  const modules = {
    mongoose: { Types },
    '../models/order.model': { Order: {
      find(filter) {
        if (filter.status === 'in_progress') {
          return chain(order.overdueReview?.escalatedAt ? [] : [order]);
        }
        phases.push('continue-scan');
        return chain([]);
      },
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
    '../models/orderAssignment.model': { OrderAssignment: { find: () => chain([]) } },
    '../models/provider.model': { Provider: { findById: () => chain({ userId: new Types.ObjectId() }) } },
    '../models/user.model': { __esModule: true, default: { find: () => chain([{ _id: new Types.ObjectId() }]) } },
    './systemConfig.service': { getNumberConfigValue: async (_, fallback) => fallback },
    './notification.service': { createNotificationRecord: async payload => notifications.push(payload) },
    '../utils/logger': { createLogger: () => ({ error: (...args) => errors.push(args), debug() {} }) },
  };
  const file = path.join(__dirname, '../src/services/dispatch.service.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, require: name => modules[name] ?? {}, setInterval: callback => { periodic = callback; return { unref() {} }; }, clearInterval() {} }, { filename: file });
  async function drain() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
  return { service: exports.DispatchService, order, errors, notifications, updates, phases, drain, scanAgain: async () => { periodic(); await drain(); } };
}

for (const [label, value] of [['null', null], ['thiếu trường', undefined], ['object rỗng', {}], ['escalatedAt null', { escalatedAt: null }]]) {
  test(`Quét đơn overdueReview ${label} không lỗi, gửi đủ thông báo và tiếp tục quét`, async () => {
    const ctx = setup(value);
    ctx.service.startTimeoutMonitor();
    await ctx.drain();
    assert.equal(ctx.errors.length, 0);
    assert.ok(ctx.order.overdueReview.escalatedAt instanceof Date);
    assert.equal(ctx.notifications.length, 3);
    assert.ok(ctx.phases.length > 0);
    assert.equal(ctx.updates[0].options.runValidators, true);
    assert.equal(ctx.updates[0].filter.isDeleted, false);
    await ctx.scanAgain();
    assert.equal(ctx.notifications.length, 3);
  });
}

test('Đơn đã đánh dấu quá hạn giữ nguyên thời điểm, không gửi lại thông báo', async () => {
  const marked = new Date('2026-10-24T10:00:00Z');
  const ctx = setup({ escalatedAt: marked });
  ctx.service.startTimeoutMonitor();
  await ctx.drain();
  assert.equal(ctx.order.overdueReview.escalatedAt, marked);
  assert.equal(ctx.notifications.length, 0);
  assert.equal(ctx.updates.length, 0);
});

test('Hai lượt quét cạnh tranh không ghi đè dấu mốc hoặc gửi thông báo trùng', async () => {
  const ctx = setup(null, true);
  ctx.service.startTimeoutMonitor();
  await ctx.drain();
  assert.equal(ctx.notifications.length, 0);
  assert.equal(ctx.order.overdueReview.escalatedAt.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(ctx.errors.length, 0);
});