const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Bộ giả lập các phép truy vấn dùng ở đây; không kết nối MongoDB thật.
function field(document, key) {
  if (!key) return document;
  const [head, ...tail] = key.split('.');
  if (Array.isArray(document)) return document.map(item => field(item, key));
  return tail.length ? field(document?.[head], tail.join('.')) : document?.[head];
}
function expression(value, document, variables) {
  if (typeof value === 'string' && value.startsWith('$$')) return variables[value.slice(2)];
  if (typeof value === 'string' && value.startsWith('$')) return field(document, value.slice(1));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => expression(item, document, variables));
  const [operator, args] = Object.entries(value)[0];
  const values = expression(args, document, variables);
  if (operator === '$ifNull') return values[0] ?? values[1];
  if (operator === '$arrayElemAt') return values[0]?.[values[1]];
  if (operator === '$eq') return values[0] === values[1];
  if (operator === '$and') return values.every(Boolean);
  throw new Error(`Phép tính chưa được giả lập: ${operator}`);
}
function matches(document, filter, variables) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$expr') return expression(condition, document, variables);
    const value = field(document, key);
    if (condition === null) return value == null;
    if (typeof condition !== 'object') return value === condition;
    return Object.entries(condition).every(([operator, operand]) => {
      if (operator === '$type') return value instanceof Date;
      if (operator === '$lte') return value != null && value <= operand;
      throw new Error(`Điều kiện chưa được giả lập: ${operator}`);
    });
  });
}
function aggregate(rows, stages, collections, variables = {}) {
  for (const stage of stages) {
    const [operator, args] = Object.entries(stage)[0];
    if (operator === '$match') rows = rows.filter(row => matches(row, args, variables));
    else if (operator === '$sort') rows = [...rows].sort((a, b) => {
      for (const [key, direction] of Object.entries(args)) {
        const left = field(a, key), right = field(b, key);
        if (left < right) return -direction;
        if (left > right) return direction;
      }
      return 0;
    });
    else if (operator === '$limit') rows = rows.slice(0, args);
    else if (operator === '$project') rows = rows.map(row => Object.fromEntries(
      Object.keys(args).map(key => [key, row[key]])));
    else if (operator === '$set') rows = rows.map(row => ({ ...row, ...Object.fromEntries(
      Object.entries(args).map(([key, value]) => [key, expression(value, row, variables)])) }));
    else if (operator === '$lookup') rows = rows.map(row => ({ ...row, [args.as]: aggregate(
      collections[args.from], args.pipeline, collections, Object.fromEntries(
        Object.entries(args.let).map(([key, value]) => [key, expression(value, row, variables)]))),
    }));
    else throw new Error(`Giai đoạn chưa được giả lập: ${operator}`);
  }
  return rows;
}

test('KH-34: ngày tạo cũ không báo nhầm; lịch sử cũ, ranh giới và cờ cảnh báo được xử lý đúng', async () => {
  const now = new Date('2030-01-10T10:00:00Z');
  const old = new Date('2030-01-01T10:00:00Z');
  const cutoff = new Date('2030-01-09T10:00:00Z');
  const base = { status: 'in_progress', isDeleted: false, createdAt: old, updatedAt: now };
  const rows = [
    { ...base, _id: 'vừa bắt đầu', schedule: { expectedStartAt: now } },
    { ...base, _id: 'đủ ngưỡng', schedule: { expectedStartAt: cutoff } },
    { ...base, _id: 'chưa đủ', schedule: { expectedStartAt: new Date(+cutoff + 1) } },
    { ...base, _id: 'đơn cũ có lịch sử' },
    { ...base, _id: 'đơn cũ thiếu mốc' },
    { ...base, _id: 'lịch sử mới nhất' },
    { ...base, _id: 'đã cảnh báo', schedule: { expectedStartAt: old }, overdueReview: { escalatedAt: now } },
    { ...base, _id: 'đã hoàn thành', status: 'completed', schedule: { expectedStartAt: old } },
    { ...base, _id: 'đã xóa', isDeleted: true, schedule: { expectedStartAt: old } },
  ];
  const history = [
    { _id: '1', orderId: 'đơn cũ có lịch sử', status: 'in_progress', createdAt: old, isDeleted: false },
    { _id: '2', orderId: 'lịch sử mới nhất', status: 'in_progress', createdAt: old, isDeleted: false },
    { _id: '3', orderId: 'lịch sử mới nhất', status: 'in_progress', createdAt: now, isDeleted: false },
  ];
  const exports = {};
  const dependencies = {
    '../models/order.model': { Order: { aggregate: stages => aggregate(rows, stages, { orderstatuses: history }) } },
    '../models/orderStatus.model': { OrderStatus: { collection: { name: 'orderstatuses' } } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/services/orderOverdue.service.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, require: name => dependencies[name] });
  const overdue = await exports.findOverdueOrders(now, 24);
  assert.deepEqual(overdue.map(row => row._id), ['đơn cũ có lịch sử', 'đủ ngưỡng']);
  assert.equal(overdue[0].updatedAt, now);
});
