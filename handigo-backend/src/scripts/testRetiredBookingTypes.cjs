const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const express = require('express');
const http = require('node:http');
const { once } = require('node:events');
const { AppError } = require('../utils/appError');
const validators = require('../validations/order.validator');
const { validate } = require('../middlewares/validate.middleware');

// Chạy route và validation thật; cô lập controller, database và các dịch vụ ngoài.
function load(file, resolve) {
  const context = { exports: {}, require: resolve, Date, Set, Map };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}

const pass = (_req, _res, next) => next();
const controller = (req, res) => res.json({ success: true, data: req.body });
const router = load('../routes/order.routes', name => {
  if (name === 'express') return { Router: express.Router };
  if (name === '../validations/order.validator') return validators;
  if (name === '../middlewares/validate.middleware') return { validate };
  if (name === '../middlewares/role.middleware') return { roleMiddleware: () => pass };
  if (name.includes('/controllers/')) return new Proxy({}, { get: () => controller });
  if (name.includes('/middlewares/')) return new Proxy({}, { get: () => pass });
  return {};
}).default;

const isolatedRequire = name => {
  if (name === '../utils/appError') return { AppError };
  return {};
};
const { OrderService } = load('../services/order.service', isolatedRequire);
const { buildServicePricingSnapshot } = load('../services/servicePricing.service', isolatedRequire);
const id = '507f1f77bcf86cd799439011';
const payload = { serviceId: id, addressId: id, paymentMethod: 'wallet' };

async function request(server, method, path, body) {
  const encoded = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path, method, headers: encoded ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) } : {},
    }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: text }));
    });
    req.on('error', reject);
    req.end(encoded);
  });
}

async function run() {
  for (const orderType of ['normal', 'scheduled']) {
    assert.equal(validators.createOrderSchema.safeParse({ ...payload, orderType }).success, true);
    assert.equal(validators.previewBookingSchema.safeParse({ serviceId: id, orderType }).success, true);
  }
  for (const orderType of ['recurring', 'urgent']) {
    assert.equal(validators.createOrderSchema.safeParse({ ...payload, orderType }).success, false);
    assert.equal(validators.previewBookingSchema.safeParse({ serviceId: id, orderType }).success, false);
    await assert.rejects(OrderService.createOrder({ ...payload, orderType }), error => error.statusCode === 400);
    await assert.rejects(buildServicePricingSnapshot({}, [], undefined, undefined, orderType), error => error.statusCode === 400);
  }
  for (const extra of [{ recurrenceUnit: 'weekly' }, { recurrenceCount: 3 }]) {
    assert.equal(validators.createOrderSchema.safeParse({ ...payload, ...extra }).success, false);
    assert.equal(validators.previewBookingSchema.safeParse({ serviceId: id, ...extra }).success, false);
  }
  assert.equal(validators.cancellationPreviewQuerySchema.safeParse({ scope: 'single' }).success, true);
  assert.equal(validators.cancellationPreviewQuerySchema.safeParse({ scope: 'series' }).success, false);
  assert.equal(OrderService.getRecurringSeries, undefined);
  assert.equal(OrderService.cancelRecurringSeries, undefined);

  const app = express();
  app.use(express.json());
  app.use('/orders', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const orderType of ['normal', 'scheduled']) {
      assert.equal((await request(server, 'POST', '/orders', { ...payload, orderType })).status, 200);
      assert.equal((await request(server, 'POST', '/orders/preview', { serviceId: id, orderType })).status, 200);
    }
    for (const orderType of ['recurring', 'urgent']) {
      assert.equal((await request(server, 'POST', '/orders', { ...payload, orderType })).status, 400);
      assert.equal((await request(server, 'POST', '/orders/preview', { serviceId: id, orderType })).status, 400);
    }
    assert.equal((await request(server, 'GET', `/orders/${id}/series`)).status, 404);
    assert.equal((await request(server, 'PATCH', `/orders/${id}/cancel-series`, { reason: 'Hủy lịch' })).status, 404);
    assert.equal((await request(server, 'GET', `/orders/${id}/cancellation-preview?scope=series`)).status, 400);
    assert.equal((await request(server, 'GET', `/orders/${id}/cancellation-preview?scope=single`)).status, 200);
    console.log('Đạt: chỉ nhận đặt ngay/hẹn giờ, từ chối loại đơn và tham số đã bỏ, gỡ API chuỗi, chặn cả lời gọi service nội bộ.');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
