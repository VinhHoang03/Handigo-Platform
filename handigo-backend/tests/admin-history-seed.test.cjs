const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { historySpecifications } = require('../src/scripts/seedAdminMonthlyHistory');

test('Lô lịch sử có 55 mã riêng, 48 đơn hoàn thành và 7 đơn hủy đúng tháng 6–9/2026', () => {
  const rows = historySpecifications();
  assert.equal(rows.length, 55);
  assert.equal(new Set(rows.map(row => row.code)).size, rows.length);
  assert.equal(rows.filter(row => row.completed).length, 48);
  assert.equal(rows.filter(row => !row.completed).length, 7);
  assert.deepEqual([6, 7, 8, 9].map(month => rows.filter(row => row.month === month).length), [9, 15, 11, 20]);
  for (const row of rows) {
    const local = new Date(row.createdAt.getTime() + 7 * 3600000);
    assert.equal(local.getUTCMonth() + 1, row.month);
    assert.equal(local.getUTCFullYear(), 2026);
    assert(row.createdAt > new Date('2026-06-24T10:00:00+07:00'));
    assert(row.quantity >= 1 && row.quantity <= 4);
    if (row.kind !== 0) assert(row.createdAt > new Date('2026-07-20T23:59:59+07:00'));
  }
  const times = rows.map(row => row.createdAt.getTime());
  assert(times.every((value, index) => !index || value - times[index - 1] >= 6 * 3600000));
  assert.deepEqual(historySpecifications(), rows);
});
