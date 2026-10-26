const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function setup(saved = new Map()) {
  const context = { exports: {}, crypto, sessionStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  }, require: () => ({ BOOKING_CREATE_ATTEMPT_KEY: 'attempt' }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/features/booking/utils/createBookingOnce.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { saved, create: context.exports.createBookingOnce };
}

test('KH-31: mất phản hồi rồi tải lại trang vẫn gửi cùng khóa và giữ một đơn', async () => {
  const first = setup();
  const orders = new Map();
  let loseResponse = true;
  const send = async (payload, id) => {
    if (!orders.has(id)) orders.set(id, { _id: id, ...payload });
    if (loseResponse) { loseResponse = false; throw new Error('Mất phản hồi sau khi tạo đơn.'); }
    return orders.get(id);
  };
  const payload = { serviceId: 'dịch vụ', voucherCode: 'GIAMGIA' };
  await assert.rejects(first.create(payload, send));
  const reloaded = setup(first.saved);
  const order = await reloaded.create(payload, send);
  assert.equal(orders.size, 1);
  assert.equal(order.voucherCode, 'GIAMGIA');
});

test('KH-31: đổi nội dung sau lỗi không thanh toán nhầm đơn cũ', async () => {
  const { create } = setup();
  let lost = true;
  const sent = [];
  const send = async (payload, id) => {
    sent.push({ payload, id });
    if (lost) { lost = false; throw new Error('Mất phản hồi.'); }
    return { _id: 'đơn cũ' };
  };
  await assert.rejects(create({ addressId: 'địa chỉ A' }, send));
  await assert.rejects(create({ addressId: 'địa chỉ B' }, send), error => error.createdOrderId === 'đơn cũ');
  assert.equal(sent[0].id, sent[1].id);
  assert.equal(sent[1].payload.addressId, 'địa chỉ A');
});

test('KH-31: lỗi validation đã xác định cho phép sửa nội dung và xác nhận lại', async () => {
  const { create, saved } = setup();
  await assert.rejects(create({}, async () => { throw { response: { status: 400 } }; }));
  assert.equal(saved.size, 0);
  await create({ serviceId: 'đã sửa' }, async payload => ({ _id: 'đơn mới', ...payload }));
  assert.equal(JSON.parse(saved.get('attempt')).payload.serviceId, 'đã sửa');
});

test('KH-31: lỗi của phiên cũ không xóa lần xác nhận thuộc phiên mới', async () => {
  const { create, saved } = setup();
  let reject;
  const pending = create({}, () => new Promise((_resolve, fail) => { reject = fail; }));
  saved.set('attempt', 'lần xác nhận của phiên mới');
  reject({ response: { status: 400 } });
  await assert.rejects(pending);
  assert.equal(saved.get('attempt'), 'lần xác nhận của phiên mới');
});

test('Tạm mở giờ booking cả ngày nhưng vẫn chặn thời điểm đã qua', () => {
  const context = { exports: {}, require: () => ({}) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/features/booking/components/step2Helpers.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const helpers = context.exports;
  for (const hour of [0, 7, 21, 23]) {
    const now = new Date(2030, 0, 1, hour, 45, 30);
    assert.equal(helpers.isWithinImmediateBookingHours(now), true);
    assert.equal(helpers.getEarliestScheduledAt(now).getHours(), hour);
    assert.equal(helpers.getDefaultScheduledAt(now).slice(11), `${String(hour).padStart(2, '0')}:45:00`);
    assert.notEqual(helpers.getInitialScheduledAt('2029-01-01T10:00:00', now), '2029-01-01T10:00:00');
  }
  assert.equal(helpers.timeSlots.length, 24);
});
