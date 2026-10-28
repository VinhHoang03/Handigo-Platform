const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const crypto = require('node:crypto');

function setup() {
  const orders = new Map();
  const exports = {};
  const dependencies = {
    mongoose, crypto,
    '../models/order.model': { Order: { findOne: async filter => {
      const order = orders.get(String(filter._id));
      return order?.customerId === filter.customerId ? order : null;
    } } },
    '../utils/appError': { AppError: Error },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/services/order.service.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: name => dependencies[name] ?? {} });
  const service = exports.OrderService;
  let created = 0;
  service.createOrder = async (payload, id = new mongoose.Types.ObjectId()) => {
    created++;
    const order = { ...payload, _id: id };
    orders.set(String(id), order);
    return order;
  };
  return { service, orders, count: () => created };
}

test('KH-31: phát lại không tạo đơn hoặc giữ voucher lần nữa; khóa tách theo khách', async () => {
  const { service, count } = setup();
  const key = crypto.randomUUID();
  const first = await service.createOrderOnce({ customerId: 'khách A', voucherCode: 'UUDAI' }, key);
  const replay = await service.createOrderOnce({ customerId: 'khách A', voucherCode: 'UUDAI' }, key);
  assert.equal(String(first._id), String(replay._id));
  assert.equal(count(), 1);
  const other = await service.createOrderOnce({ customerId: 'khách B' }, key);
  assert.notEqual(String(first._id), String(other._id));
});

test('KH-31: lỗi sau khi một lượt đồng thời đã ghi đơn vẫn trả đơn đã lưu', async () => {
  const { service, orders } = setup();
  service.createOrder = async (payload, id) => {
    orders.set(String(id), { ...payload, _id: id });
    throw new Error('Lượt đồng thời đã giữ voucher.');
  };
  const order = await service.createOrderOnce({ customerId: 'khách' }, crypto.randomUUID());
  assert.equal(orders.size, 1);
  assert.equal(order.customerId, 'khách');
});

test('KH-31: khóa không hợp lệ bị từ chối; client cũ vẫn dùng luồng tạo đơn hiện tại', async () => {
  const { service, count } = setup();
  await assert.rejects(service.createOrderOnce({ customerId: 'khách' }, 'khóa sai'));
  assert.equal(count(), 0);
  await service.createOrderOnce({ customerId: 'khách' });
  assert.equal(count(), 1);
});

test('KH-31: hai lần xác nhận đồng thời cùng khóa chỉ ghi một đơn', async () => {
  const { service, orders } = setup();
  let writes = 0;
  service.createOrder = async (payload, id) => {
    await Promise.resolve();
    if (orders.has(String(id))) throw new Error('Trùng khóa đơn trong giao dịch.');
    const order = { ...payload, _id: id };
    orders.set(String(id), order);
    writes++;
    return order;
  };
  const key = crypto.randomUUID();
  const [first, second] = await Promise.all([
    service.createOrderOnce({ customerId: 'khách' }, key),
    service.createOrderOnce({ customerId: 'khách' }, key),
  ]);
  assert.equal(writes, 1);
  assert.equal(String(first._id), String(second._id));
});
