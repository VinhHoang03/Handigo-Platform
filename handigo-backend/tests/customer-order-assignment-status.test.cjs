const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

// Nạp service với database giả lập, không đọc cấu hình hoặc kết nối mạng.
function loadService(modules) {
  const file = path.join(__dirname, '../src/services/order.service.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set,
    require: name => modules[name] ?? {},
  }, { filename: file });
  return exports.OrderService;
}

function setup(items, pending = []) {
  const calls = [];
  const chain = value => ({
    sort() { return this; }, skip() { return this; }, limit() { return this; },
    populate() { return this; }, select() { return this; },
    lean: async () => value,
  });
  const service = loadService({
    mongoose: { __esModule: true, default: {}, Types },
    '../models/order.model': { Order: {
      find(query) { calls.push(['orders', query]); return chain(items); },
      countDocuments: async () => items.length,
    } },
    '../models/orderAssignment.model': { OrderAssignment: {
      find(query) { calls.push(['assignments', query]); return chain(pending); },
    } },
    '../utils/orderAddress': { withOrderAddress: order => order },
  });
  return { service, calls };
}

test('Danh sách khách hàng chỉ tra assignment của đơn trong trang và giữ trạng thái gốc', async () => {
  const customerId = new Types.ObjectId().toString();
  const created = { _id: new Types.ObjectId(), status: 'created' };
  const accepted = { _id: new Types.ObjectId(), status: 'accepted' };
  const context = setup([created, accepted], [{ orderId: created._id }]);
  const result = await context.service.getOrdersByCustomer(customerId, 1, 20);
  assert.equal(result.items[0].hasPendingAssignment, true);
  assert.equal(result.items[1].hasPendingAssignment, false);
  assert.equal(result.items[0].status, 'created');
  assert.equal(result.items[1].status, 'accepted');
  assert.equal(result.pagination.total, 2);
  assert.equal(context.calls[0][1].$and[0].customerId.toString(), customerId);
  const assignmentCalls = context.calls.filter(([type]) => type === 'assignments');
  assert.equal(assignmentCalls.length, 1);
  const query = assignmentCalls[0][1];
  assert.deepEqual(Array.from(query.orderId.$in, String), [created._id.toString()]);
  assert.equal(query.status, 'pending');
  assert.equal(query.isDeleted, false);
  assert.ok(query.responseDeadline.$gt instanceof Date);
});

test('Trang rỗng không truy vấn assignment', async () => {
  const context = setup([]);
  const result = await context.service.getOrdersByCustomer(new Types.ObjectId().toString());
  assert.equal(result.items.length, 0);
  assert.equal(context.calls.some(([type]) => type === 'assignments'), false);
});
