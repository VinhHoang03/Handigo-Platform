const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Number, require: name => {
    if (name in modules) return modules[name]; throw new Error(`Chưa giả lập module: ${name}`);
  } });
  return exports;
}
const quotationPayment = load('utils/quotationPayment.ts', {});
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { resolve, reject, promise }; };
function fixture() {
  const slots = [], requests = [], toasts = [];
  let cursor = 0, busy = false, reloads = 0;
  const useState = initial => {
    const index = cursor++; slots[index] ??= { value: initial };
    return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
  };
  const order = { _id: 'don-thu', inspectionRequired: true, status: 'completed', depositPaidAt: '2026-10-29',
    paymentStatus: 'partially_paid', paymentMethod: 'wallet' };
  const quotation = { quotation: { _id: 'bao-gia-thu', status: 'saved', revision: 2, finalAmount: 200000, directPaymentConfirmedAt: null } };
  const { useBookingQuotationPayment } = load('features/booking/components/detail/useBookingQuotationPayment.ts', {
    react: { useState, useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; } },
    '@/components/common/Toast': { useToastFeedback: useState, useToast: () => ({ addToast: (...args) => toasts.push(args) }) },
    '../../api/booking.api': { bookingApi: { createPayment: payload => {
      const pending = { payload, ...deferred() }; requests.push(pending); return pending.promise;
    } } },
    '@/utils/apiError': { getErrorMessage: error => error.message },
  });
  const render = (amount = 180000) => {
    cursor = 0;
    return useBookingQuotationPayment(order, quotation, amount, busy, value => { busy = value; }, async () => { reloads++; });
  };
  return { order, quotation, requests, toasts, render, get reloads() { return reloads; } };
}

test('Thanh toán báo giá: xác nhận đúng phiên bản/số tiền và chống bấm nhiều lần', async () => {
  const f = fixture(); f.render().open();
  const flow = f.render();
  assert.equal(flow.confirmation.amount, 180000);
  const first = flow.pay(); await flow.pay();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].payload.method, 'WALLET');
  assert.equal(f.requests[0].payload.paymentType, 'REMAINING');
  assert.equal(f.requests[0].payload.expectedAmount, 180000);
  assert.equal(f.requests[0].payload.quotationId, 'bao-gia-thu');
  assert.equal(f.requests[0].payload.expectedRevision, 2);
  f.requests[0].resolve({ payment: { status: 'paid' } }); await first;
  assert.equal(f.render().confirmation, null); assert.equal(f.reloads, 1);
  assert.equal(f.toasts[0][1], 'success');
});

test('Chặn trạng thái chưa đủ điều kiện, báo giá thay đổi và xác nhận trực tiếp', async () => {
  for (const change of [f => { f.order.status = 'in_progress'; }, f => { f.order.status = 'cancelled'; },
    f => { f.order.paymentStatus = 'paid'; }, f => { f.order.depositPaidAt = null; },
    f => { f.quotation.quotation.directPaymentConfirmedAt = '2026-10-29'; },
    f => { f.quotation.quotation.status = 'rejected'; }]) {
    const f = fixture(); change(f); assert.equal(f.render().canPay, false);
    f.render().open(); assert.equal(f.render().confirmation, null);
  }
  const f = fixture(); f.render().open(); f.quotation.quotation.revision++;
  await f.render().pay(); assert.equal(f.requests.length, 0); assert.match(f.render().error, /đã thay đổi/);
});

test('Thiếu số dư: giữ cửa sổ, hiển thị lỗi và cho phép thử lại', async () => {
  const f = fixture(); f.render().open();
  const pending = f.render().pay(); f.requests[0].reject(new Error('Số dư ví không đủ')); await pending;
  assert.match(f.render().error, /không đủ/); assert.ok(f.render().confirmation);
  const retry = f.render().pay(); assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ payment: { status: 'paid' } }); await retry;
  assert.equal(f.render().confirmation, null);
});

test('Đã trả bằng ví: không hiển thị khoản phải trả lại; xác nhận trực tiếp vẫn có phương thức riêng', () => {
  const f = fixture(); f.order.paymentStatus = 'paid';
  assert.equal(quotationPayment.isQuotationPaidByWallet(f.order, f.quotation.quotation), true);
  assert.equal(quotationPayment.getRemainingQuotationPayment(f.quotation.quotation, 20000, 'completed', true), 0);
  f.quotation.quotation.directPaymentConfirmedAt = '2026-10-29';
  assert.equal(quotationPayment.isQuotationPaidByWallet(f.order, f.quotation.quotation), false);
  f.quotation.quotation.directPaymentConfirmedAmount = 180000;
  assert.equal(quotationPayment.getRemainingQuotationPayment(f.quotation.quotation, 20000, 'completed'), 0);
});
