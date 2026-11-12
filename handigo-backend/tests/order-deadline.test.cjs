const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.join(__dirname, '../src/services/orderDeadline.service.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(patch = {}, reconcile = order => order) {
  const order = { _id: 'order-id', status: 'created', isDeleted: false, paymentMethod: 'bank',
    paymentStatus: 'unpaid', updatedAt: new Date(), paymentDueAt: new Date(0), ...patch };
  const cancellations = [];
  let timer;
  const modules = {
    '../models/order.model': { Order: { findById: async () => order } },
    '../utils/logger': { createLogger: () => ({ error(error) { assert.fail(error); } }) },
    './payment.service': { reconcilePayosPaymentForExpiration: async () => ({ order: reconcile(order) }) },
    './orderCancellation.service': { cancelSystemOrderWithSettlement: async (...args) => {
      cancellations.push(args);
      order.status = 'cancelled';
    } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, require: name => modules[name] ?? {},
    setTimeout: (run, delay) => { timer = { run, delay, unref() {} }; return timer; }, clearTimeout() {} }, { filename: file });
  exports.scheduleOrderDeadline(order);
  return { timer, cancellations, async fire() { timer.run(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('Đơn chưa trả chỉ hủy khi đã đối soát và vẫn chưa nhận tiền', async () => {
  const ctx = setup();
  await ctx.fire();
  assert.equal(ctx.cancellations[0][2], 'payment_timeout');
  const paid = setup({}, order => ({ ...order, paymentStatus: 'paid' }));
  await paid.fire();
  assert.equal(paid.cancellations.length, 0);
  assert.equal(setup({ paymentMethod: 'cash' }).timer, undefined);
});

test('Đơn đã nhận chỉ hủy sau một giờ nếu thợ chưa đến', async () => {
  const scheduled = { status: 'accepted', providerId: 'provider-id', paymentStatus: 'paid',
    schedule: { expectedStartAt: new Date() } };
  assert.ok(setup(scheduled).timer.delay > 3_590_000);
  assert.equal(setup({ ...scheduled, arrival: { providerId: 'provider-id' } }).timer, undefined);
  const expired = setup({ ...scheduled, schedule: { expectedStartAt: new Date(0) } });
  await expired.fire();
  assert.equal(expired.cancellations[0][2], 'provider_late');
});
