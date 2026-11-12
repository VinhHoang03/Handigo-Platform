const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const calls = { settlements: [], rewards: 0, events: [], debits: 0 };
  let settled = false;
  const order = { _id: 'order', customerId: 'customer', providerId: 'provider',
    status: 'completed', paymentStatus: 'unpaid', paymentMethod: 'cash', inspectionRequired: false,
    pricing: { baseAmount: 120000, bookingAmount: 120000, totalPaidAmount: 108000 },
    save: async () => {} };
  const pending = { _id: 'payment', method: 'cash', status: 'pending', amount: 108000 };
  const query = value => ({ session: async () => value, select: () => ({ lean: async () => value }) });
  const session = { withTransaction: work => work(), endSession: async () => {} };
  class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => session } },
    '../models/order.model': { Order: { findById: () => query(order) } },
    '../models/provider.model': { Provider: { findOne: () => query({ _id: 'provider', userId: 'worker' }),
      findById: () => query({ userId: 'worker' }) } },
    '../models/payment.model': { Payment: {
      findOne: () => query(pending),
      findOneAndUpdate: (_filter, update) => { Object.assign(pending, update.$set); return Promise.resolve(pending); },
      aggregate: () => query([{ total: 108000 }]),
    } },
    '../models/wallet.model': { Wallet: { findOneAndUpdate: async () => { calls.debits++; return { _id: 'wallet', balance: 1000 }; } } },
    '../models/walletTransaction.model': { WalletTransaction: { exists: () => query(settled), create: async () => {} } },
    './wallet.service': { recordCompletedOrderSettlement: async (current, _provider, currentSession) => {
      assert.equal(currentSession, session);
      calls.settlements.push({ method: current.paymentMethod, amount: current.pricing.totalPaidAmount });
      settled = true;
    } },
    './reward.service': { earnOrderRewards: async () => { calls.rewards++; } },
    './voucher.service': { markOrderVoucherAsUsed: async () => {} },
    './notification.service': { createNotificationRecord: async () => {} },
    '../sockets/socketServer': { emitToUser: (...args) => calls.events.push(args) },
    '../utils/logger': { createLogger: () => ({ warn() {}, error() {} }) },
    '../utils/transaction': { buildTransactionCode: () => 'PAYMENT', withTransactionRetry: (_session, work) => work() },
    '../utils/appError': { AppError },
    '../utils/actionPreconditionError': { ActionPreconditionError: AppError },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/payment.service.ts'), 'utf8') +
    '\nexport const testAccess = { isFixedPriceWorkPayment, assertConfirmedPayment, createWalletPayment, reserveExternalPayment, syncPaidPayosPaymentToOrder, publishOrderPaymentUpdate };';
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { exports, require: name => modules[name] ?? {}, Date, process });
  return { api: exports.testAccess, order, calls, session };
}

test('Chỉ cho đơn cố định đang làm hoặc đã nghiệm thu chưa trả tiền tiếp tục đổi phương thức', () => {
  const f = fixture();
  for (const status of ['in_progress', 'completed']) {
    f.order.status = status;
    assert.equal(f.api.isFixedPriceWorkPayment(f.order), true);
    f.api.assertConfirmedPayment(f.order, 108000, 'full', { amount: 108000, paymentType: 'full' });
  }
  for (const patch of [{ status: 'cancelled' }, { status: 'completed', paymentStatus: 'paid' },
    { paymentStatus: 'unpaid', inspectionRequired: true }]) {
    Object.assign(f.order, patch);
    assert.equal(f.api.isFixedPriceWorkPayment(f.order), false);
  }
});

test('Ví sau nghiệm thu thay tiền mặt, trừ đúng tiền sau voucher, quyết toán và cập nhật hai phía', async () => {
  const f = fixture();
  const result = await f.api.createWalletPayment(f.order, 'full', 108000,
    { amount: 108000, paymentType: 'full' }, 'payment');
  assert.equal(result.payment.status, 'paid');
  assert.equal(f.order.status, 'completed');
  assert.equal(f.order.paymentStatus, 'paid');
  assert.equal(f.order.paymentMethod, 'wallet');
  assert.deepEqual(f.calls.settlements, [{ method: 'wallet', amount: 108000 }]);
  assert.equal(f.calls.debits, 1);
  assert.equal(f.calls.rewards, 1);
  assert.deepEqual(f.calls.events.map(event => event.slice(0, 2)), [['customer', 'order:updated'], ['worker', 'order:updated']]);
});

test('QR đã xác minh sau nghiệm thu ghi thu nhập một lần khi đồng bộ lặp lại', async () => {
  const f = fixture();
  const payment = { orderId: 'order', paymentType: 'full', status: 'paid' };
  await f.api.syncPaidPayosPaymentToOrder(payment, f.session);
  await f.api.syncPaidPayosPaymentToOrder(payment, f.session);
  assert.equal(f.order.paymentMethod, 'bank');
  assert.equal(f.order.paymentStatus, 'paid');
  assert.equal(f.order.status, 'completed');
  assert.deepEqual(f.calls.settlements, [{ method: 'bank', amount: 108000 }]);
});

test('Tạo QR sau nghiệm thu thay tiền mặt đang chờ, giữ trạng thái chưa thanh toán và chưa ghi thu nhập', async () => {
  const f = fixture();
  const result = await f.api.reserveExternalPayment({ id: 'customer', role: 'CUSTOMER' },
    { paymentType: 'FULL', method: 'PAYOS' }, 'payos', 12345,
    { amount: 108000, paymentType: 'full' }, 'payment');
  assert.equal(result.payment.method, 'payos');
  assert.equal(result.payment.status, 'pending');
  assert.equal(f.order.paymentMethod, 'bank');
  assert.equal(f.order.paymentStatus, 'unpaid');
  assert.equal(f.order.status, 'completed');
  assert.equal(f.calls.settlements.length, 0);
});

test('Ví sai số tiền xác nhận không trừ tiền hoặc quyết toán', async () => {
  const f = fixture();
  await assert.rejects(f.api.createWalletPayment(f.order, 'full', 108000,
    { amount: 120000, paymentType: 'full' }, 'payment'));
  assert.equal(f.calls.debits, 0);
  assert.equal(f.calls.settlements.length, 0);
});

test('Thanh toán trước nghiệm thu chưa quyết toán; đơn hủy không áp giao dịch QR', async () => {
  const f = fixture();
  f.order.status = 'in_progress';
  await f.api.syncPaidPayosPaymentToOrder({ paymentType: 'full' }, f.session);
  assert.equal(f.calls.settlements.length, 0);
  f.order.status = 'cancelled'; f.order.paymentStatus = 'unpaid';
  await f.api.syncPaidPayosPaymentToOrder({ paymentType: 'full' }, f.session);
  assert.equal(f.order.paymentStatus, 'unpaid');
});
