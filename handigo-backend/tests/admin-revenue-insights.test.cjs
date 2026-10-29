const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { WalletTransaction } = require('../src/models/walletTransaction.model');
const { Payment } = require('../src/models/payment.model');
const { Report } = require('../src/models/report.model');
const { getAdminRevenueInsights } = require('../src/services/adminRevenueInsights.service');
const query = { fromDate: new Date('2026-09-30T17:00:00Z'), toDate: new Date('2026-10-31T16:59:59.999Z') };

test('Cơ cấu dịch vụ giữ đúng tổng, so sánh tháng trước và dịch vụ giảm về 0', async t => {
  t.after(() => mock.restoreAll());
  let calls = 0;
  mock.method(WalletTransaction, 'aggregate', async pipeline => {
    const match = pipeline[0].$match;
    assert.equal(match.status, 'success');
    assert.equal(match.isDeleted, false);
    assert.equal(match.type, 'provider_earning');
    assert.equal(match.direction, 'in');
    assert.deepEqual(match['metadata.netEarning'], { $exists: true });
    assert.deepEqual(pipeline.find(stage => stage.$group).$group.revenue, { $sum: { $ifNull: ['$metadata.grossAmount', '$amount'] } });
    if (++calls === 1) return [{ serviceId: 's1', name: 'Điện lạnh', categoryName: 'Điện', revenue: 300000, completedOrders: 2 },
      { serviceId: null, name: 'Chưa phân loại', categoryName: 'Chưa phân loại', revenue: 100000, completedOrders: 1 }];
    assert.equal(match.createdAt.$gte.toISOString(), '2026-08-31T17:00:00.000Z');
    return [{ serviceId: 's1', name: 'Điện lạnh', revenue: 200000 }, { serviceId: 's2', name: 'Vệ sinh', revenue: 50000 }];
  });
  mock.method(Payment, 'aggregate', async pipeline => {
    const match = pipeline[0].$match;
    assert.equal(match.isDeleted, false);
    if (match.refundedAt) {
      assert.equal(match.status, 'refunded');
      assert.deepEqual(pipeline[1].$group.amount, { $sum: { $ifNull: ['$metadata.refund.amount', '$amount'] } });
      return [{ method: 'wallet', amount: 25000, count: 1 }, { method: 'cash', amount: 50000, count: 1 }];
    }
    assert.deepEqual(match.status, { $in: ['paid', 'refunded'] });
    assert.equal(match.paidAt.$gte, query.fromDate);
    return [{ method: 'wallet', amount: 100000, count: 1 }, { method: 'payos', amount: 300000, count: 2 }];
  });
  mock.method(Report, 'aggregate', async pipeline => {
    const match = pipeline[0].$match;
    assert.deepEqual(match.status, { $in: ['pending', 'under_review', 'confirmed'] });
    assert.ok(match.reportType.$in.includes('harassment'));
    assert.ok(!match.reportType.$in.includes('system_bug'));
    assert.equal(match.isDeleted, false);
    return [{ items: [{ userId: 'u1', reports: 2, confirmed: 1 }], total: [{ count: 1 }] }];
  });
  const data = await getAdminRevenueInsights(query);
  assert.equal(data.totalServiceRevenue, 400000);
  assert.equal(data.services.reduce((total, row) => total + row.revenue, 0), 400000);
  assert.equal(data.services.find(row => row.serviceId === 's1').changePercent, 50);
  assert.equal(data.services.find(row => row.serviceId === 's2').changePercent, -100);
  assert.equal(data.services.find(row => row.serviceId === null).share, 25);
  assert.equal(data.topServices[0].completedOrders, 2);
  assert.equal(data.channels.find(row => row.method === 'wallet').net, 75000);
  assert.equal(data.channels.find(row => row.method === 'payos').share, 75);
  assert.equal(data.channels.find(row => row.method === 'cash').net, -50000);
  assert.equal(data.behaviorRisks.total, 1);
});

test('Dữ liệu rỗng vẫn có ba kênh chính và không phát sinh NaN', async t => {
  t.after(() => mock.restoreAll());
  for (const model of [WalletTransaction, Payment, Report]) mock.method(model, 'aggregate', async () => []);
  const data = await getAdminRevenueInsights(query);
  assert.equal(data.services.length, 0);
  assert.equal(data.behaviorRisks.total, 0);
  assert.deepEqual(data.channels.map(row => row.method), ['wallet', 'payos', 'cash']);
  assert.ok(data.channels.every(row => row.share === 0 && row.net === 0));
});
