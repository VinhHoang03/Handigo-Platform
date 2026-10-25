const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = path.resolve(__dirname, '../../../handigo-web/src/features/booking/components/pendingBookingRecovery.ts');
let reads = 0, discards = 0, revision = 0, order, readError, discardError, resolveRead;
const api = {
  getOrderById: async () => {
    reads++;
    if (readError) throw readError;
    if (resolveRead) return resolveRead;
    return order;
  },
  discardUnpaidOrder: async () => { discards++; if (discardError) { order = { ...order, paymentStatus: 'paid' }; throw discardError; } },
};
const context = { exports: {}, require: name => {
  if (name === '../api/booking.api') return { bookingApi: api };
  if (name === '../utils/bookingSessionStorage') return { getBookingSessionRevision: () => revision };
  throw new Error(name);
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const recover = context.exports.recoverPendingBooking;
(async () => {
  order = { _id: 'don', paymentStatus: 'unpaid', voucherSnapshot: { code: 'CU30' } };
  const [one, two] = await Promise.all([recover('don'), recover('don')]);
  assert.equal(reads, 1); assert.equal(discards, 1);
  assert.equal(one.voucherCode, 'CU30'); assert.equal(two.voucherCode, 'CU30');
  order.paymentStatus = 'paid';
  assert.equal((await recover('don')).paidOrder._id, 'don'); assert.equal(discards, 1);
  order.paymentStatus = 'unpaid'; discardError = new Error('Thanh toán vừa được xác nhận');
  assert.equal((await recover('don')).paidOrder.paymentStatus, 'paid');
  const before = discards;
  readError = new Error('Mất kết nối');
  await assert.rejects(recover('don')); assert.equal(discards, before);
  readError = null; discardError = null;
  let finish;
  resolveRead = new Promise(resolve => { finish = resolve; });
  const stale = recover('don'); revision++;
  finish({ _id: 'don', paymentStatus: 'unpaid' });
  await assert.rejects(stale); assert.equal(discards, before);
  console.log('Đạt: khôi phục mã sau loại bỏ đơn chưa trả, gộp request, không thu lại đơn đã trả và không xử lý nhầm phiên cũ.');
})().catch(error => { console.error(error); process.exitCode = 1; });
