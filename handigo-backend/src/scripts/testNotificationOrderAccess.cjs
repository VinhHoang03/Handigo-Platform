const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

// Chạy service thật với dữ liệu giả lập; không kết nối database hoặc đọc cấu hình bí mật.
function setup() {
  const userA = new Types.ObjectId();
  const userB = new Types.ObjectId();
  const providerA = new Types.ObjectId();
  const providerB = new Types.ObjectId();
  const order = { _id: new Types.ObjectId(), providerId: providerA, isDeleted: false, previousProviderIds: [] };
  const records = [];
  const queries = [];
  const query = value => ({
    sort() { return this; }, skip() { return this; }, limit() { return this; }, select() { return this; },
    lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => String(record[key]) === String(value));
  class AppError extends Error { constructor(message, status) { super(message); this.statusCode = status; } }
  const modules = {
    mongoose: { Types },
    '../models/notification.model': { Notification: {
      find(filter) { queries.push(['notifications', filter]); return query(records.filter(record => matches(record, filter))); },
      countDocuments: async filter => records.filter(record => matches(record, filter)).length,
      findOne: async filter => records.find(record => matches(record, filter)) || null,
    } },
    '../models/order.model': { Order: { find(filter) {
      queries.push(['orders', filter]);
      const found = filter._id.$in.includes(String(order._id)) && !order.isDeleted
        && String(order.providerId) !== String(filter.providerId.$ne)
        && order.previousProviderIds.some(id => String(id) === String(filter['reassignment.previousProviderIds']));
      return query(found ? [order] : []);
    } } },
    '../models/provider.model': { Provider: { findOne(filter) {
      queries.push(['provider', filter]);
      return query({ _id: String(filter.userId) === String(userA) ? providerA : providerB });
    } } },
    '../models/user.model': {},
    '../utils/appError': { AppError },
    '../utils/mongo': { toObjectId: id => new Types.ObjectId(id) },
    '../sockets/socketServer': { emitToUser() {} },
  };
  const filename = path.join(__dirname, '../services/notification.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) { assert.ok(name in modules, `Chưa giả lập ${name}`); return modules[name]; } });
  const add = (userId = userA, type = 'ORDER', data = { orderId: order._id }) => {
    const record = { _id: new Types.ObjectId(), userId, type, data, title: 'Có đơn dịch vụ', content: 'Nội dung cũ',
      isDeleted: false, isRead: false, save: async () => {} };
    records.push(record);
    return record;
  };
  const user = (id = userA, role = 'PROVIDER') => ({ id: String(id), role });
  return { service: exports, user, userA, userB, providerA, providerB, order, records, queries, add,
    cancel() { order.providerId = null; order.previousProviderIds = [providerA]; },
    list(who = user()) { return exports.getMyNotifications(who, { page: 1, limit: 20 }); },
  };
}

test('Thông báo cũ được đánh dấu ngay khi hủy và vẫn đúng sau khi thợ mới nhận', async () => {
  const runtime = setup();
  const record = runtime.add();
  assert.equal((await runtime.list()).items[0].data.orderUnavailable, undefined);
  runtime.cancel();
  for (const providerId of [null, runtime.providerB]) {
    runtime.order.providerId = providerId;
    const { items } = await runtime.list();
    assert.equal(items[0].data.orderUnavailable, true);
    assert.equal(items[0].data.orderUnavailableReason, 'Bạn không còn phụ trách đơn hàng này.');
    assert.equal(items[0].content, 'Nội dung cũ');
  }
  assert.equal(record.data.orderUnavailable, undefined, 'Không ghi đè lịch sử trong database');
});

test('Không đánh dấu thông báo của khách, thợ mới, ví hoặc thông báo chung', async () => {
  const runtime = setup();
  runtime.cancel();
  runtime.order.providerId = runtime.providerB;
  runtime.add(runtime.userA, 'ORDER');
  runtime.add(runtime.userA, 'QUOTATION');
  runtime.add(runtime.userA, 'PAYMENT');
  runtime.add(runtime.userA, 'WITHDRAWAL');
  runtime.add(runtime.userA, 'SYSTEM');
  runtime.add(runtime.userB, 'ORDER');
  const { items } = await runtime.list();
  assert.equal(items.filter(item => item.data.orderUnavailable).length, 2);
  assert.ok(items.every(item => String(item.userId) === String(runtime.userA)));
  assert.equal((await runtime.list(runtime.user(runtime.userB))).items[0].data.orderUnavailable, undefined);
  assert.ok((await runtime.list(runtime.user(runtime.userA, 'CUSTOMER'))).items.every(item => !item.data.orderUnavailable));
});

test('Bấm thông báo đã đọc cũng lấy hiệu lực mới nhất, không mở quyền cho người khác', async () => {
  const runtime = setup();
  const record = runtime.add();
  await runtime.service.markAsRead(runtime.user(), String(record._id));
  assert.equal(record.isRead, true);
  runtime.cancel();
  const latest = await runtime.service.markAsRead(runtime.user(), String(record._id));
  assert.equal(latest.data.orderUnavailable, true);
  await assert.rejects(runtime.service.markAsRead(runtime.user(runtime.userB), String(record._id)), error => error.statusCode === 404);
});

test('Tra đơn theo lô và bỏ qua orderId cũ không hợp lệ', async () => {
  const runtime = setup();
  runtime.cancel();
  runtime.add();
  runtime.add(runtime.userA, 'ORDER', { orderId: String(runtime.order._id) });
  runtime.add(runtime.userA, 'ORDER', { orderId: 'khong-hop-le' });
  runtime.add(runtime.userA, 'ORDER', null);
  const result = await runtime.list();
  assert.equal(result.items.filter(item => item.data?.orderUnavailable).length, 2);
  const queries = runtime.queries.filter(([type]) => type === 'orders');
  assert.equal(queries.length, 1);
  assert.deepEqual(Array.from(queries[0][1]._id.$in), [String(runtime.order._id)]);
});
