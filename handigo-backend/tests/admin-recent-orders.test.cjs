const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Order } = require('../src/models/order.model');
const { getAdminRecentOrders } = require('../src/services/adminRecentOrders.service');
const { adminRecentOrdersQuerySchema } = require('../src/validations/dashboard.validator');

test('Đơn mới nhất được sắp xếp ổn định, phân trang và chỉ trả thông tin cần hiển thị', async t => {
  t.after(() => mock.restoreAll());
  const calls = {};
  const query = {};
  for (const method of ['sort', 'skip', 'limit', 'select', 'populate']) {
    query[method] = value => { (calls[method] ??= []).push(value); return query; };
  }
  query.lean = async () => [{ orderCode: 'ORD-25' }];
  mock.method(Order, 'find', filter => { assert.deepEqual(filter, { isDeleted: false }); return query; });
  mock.method(Order, 'countDocuments', async filter => { assert.deepEqual(filter, { isDeleted: false }); return 25; });
  const result = await getAdminRecentOrders({ page: 2, limit: 5 });
  assert.deepEqual(calls.sort[0], { createdAt: -1, _id: -1 });
  assert.equal(calls.skip[0], 5);
  assert.equal(calls.limit[0], 5);
  assert.equal(calls.select[0], 'orderCode serviceId customerId pricing.totalPaidAmount status createdAt');
  assert.deepEqual(calls.populate[1], { path: 'customerId', select: 'fullName', match: { isDeleted: false } });
  assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 25, totalPages: 5 });
});

test('Giới hạn truy vấn đơn mới không nhận số trang hoặc kích thước trang không hợp lệ', () => {
  assert.deepEqual(adminRecentOrdersQuerySchema.parse({ page: '2', limit: '20' }), { page: 2, limit: 20 });
  for (const query of [{ page: 0 }, { page: -1 }, { page: 'x' }, { limit: 101 }, { limit: 0 }]) {
    assert.equal(adminRecentOrdersQuerySchema.safeParse(query).success, false);
  }
});
