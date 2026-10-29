const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Order } = require('../src/models/order.model');
const { WalletTransaction } = require('../src/models/walletTransaction.model');
const { getAdminMonthlyTrend } = require('../src/services/adminMonthlyTrend.service');

test('Lấy tối thiểu sáu tháng và điền 0 ở tháng không phát sinh', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(Order, 'aggregate', async pipeline => {
    assert.equal(pipeline[0].$match.isDeleted, false);
    assert.equal(pipeline[0].$match.status, 'completed');
    assert.equal(pipeline[3].$match.completedAt.$gte.toISOString(), '2026-04-30T17:00:00.000Z');
    assert.equal(pipeline[4].$group._id.$dateToString.timezone, 'Asia/Ho_Chi_Minh');
    assert.equal(pipeline[4].$group._id.$dateToString.date, '$completedAt');
    assert.equal(pipeline[4].$group.amount.$sum.$ifNull[0], '$pricing.bookingAmount');
    return [{ _id: '2026-05', count: 2, amount: 1250000 }, { _id: '2026-10', count: 12, amount: 7000000 }];
  });
  mock.method(WalletTransaction, 'aggregate', async pipeline => {
    assert.equal(pipeline[0].$match.type, 'platform_fee');
    assert.equal(pipeline[0].$match.direction, 'out');
    assert.equal(pipeline[0].$match.status, 'success');
    assert.deepEqual(pipeline[0].$match['metadata.netEarning'], { $exists: true });
    assert.deepEqual(pipeline[1].$lookup.pipeline[0].$match, { isDeleted: false, status: 'completed', paymentStatus: 'paid' });
    assert.equal(pipeline[3].$lookup.pipeline[0].$match.type, 'provider_earning');
    assert.equal(pipeline[3].$lookup.pipeline[0].$match.status, 'success');
    assert.deepEqual(pipeline[4].$match['settledEarning.0'], { $exists: true });
    return [{ _id: '2026-05', amount: 125000 }];
  });
  const data = await getAdminMonthlyTrend({ fromDate: new Date('2026-10-01T00:00:00+07:00'), toDate: new Date('2026-10-31T23:59:59+07:00') });
  assert.equal(data.points.length, 6);
  assert.deepEqual(data.points[0], { month: '2026-05', orders: 2, completedRevenue: 1250000, platformRevenue: 125000 });
  assert.deepEqual(data.points[1], { month: '2026-06', orders: 0, completedRevenue: 0, platformRevenue: 0 });
  assert.deepEqual(data.points[5], { month: '2026-10', orders: 12, completedRevenue: 7000000, platformRevenue: 0 });
});

test('Giữ thứ tự tháng qua năm mới và hỗ trợ khoảng lịch sử dài hơn sáu tháng', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(Order, 'aggregate', async () => []);
  mock.method(WalletTransaction, 'aggregate', async () => []);
  const january = await getAdminMonthlyTrend({}, new Date('2026-12-31T18:00:00Z'));
  assert.deepEqual(january.points.map(point => point.month), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  const extended = await getAdminMonthlyTrend({ fromDate: new Date('2026-01-15T00:00:00+07:00'), toDate: new Date('2026-10-28T00:00:00+07:00') });
  assert.equal(extended.points.length, 10);
  assert.equal(extended.points[0].month, '2026-01');
  await assert.rejects(getAdminMonthlyTrend({ fromDate: new Date('2027-01-01'), toDate: new Date('2026-10-01') }), error => error.statusCode === 400);
});
