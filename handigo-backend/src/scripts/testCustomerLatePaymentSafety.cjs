const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { AppError } = require('../utils/appError');
const { withTransactionRetry } = require('../utils/transaction');

// Snapshot và index được giả lập; service thật chạy không cần database hoặc cấu hình PayOS.
let state, revision, failTransaction, failNotification, gateway, emitted, dispatched, commits, fallback, beforeCommit;
const copy = value => structuredClone(value);
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  const field = key.split('.').reduce((item, part) => item?.[part], row);
  if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(field);
  if (value && typeof value === 'object' && '$ne' in value) return field !== value.$ne;
  return field === value;
});
const view = session => session?.snapshot ?? state;
function query(read) {
  return { session(value) { this.context = value; return this; }, select() { return this; }, sort() { return this; },
    then(resolve, reject) { return Promise.resolve().then(() => read(this.context)).then(resolve, reject); } };
}
function document(row, collection, session) {
  if (!row) return null;
  const result = copy(row);
  result.save = async options => {
    const target = view(options?.session ?? session);
    const { save, ...data } = result;
    if (collection === 'payments' && ['pending', 'paid'].includes(data.status) && !data.isDeleted) {
      assert(!target.payments.some(other => other._id !== data._id && !other.isDeleted
        && ['pending', 'paid'].includes(other.status) && other.orderId === data.orderId && other.paymentType === data.paymentType),
      'Không được vi phạm index chống thanh toán trùng');
    }
    if (collection === 'order') target.order = copy(data);
    else target.payments[target.payments.findIndex(item => item._id === data._id)] = copy(data);
  };
  return result;
}
function reset() {
  state = {
    order: { _id: 'don', customerId: 'khach', status: 'created', paymentStatus: 'unpaid', orderType: 'normal',
      isDeleted: false, inspectionRequired: false, pricing: { totalPaidAmount: 80000, voucherDiscountAmount: 20000 },
      voucherSnapshot: { voucherId: 'voucher' }, voucherUsedAt: null },
    payments: [{ _id: 'cu', orderId: 'don', customerId: 'khach', amount: 80000, method: 'payos',
      paymentType: 'full', status: 'failed', isDeleted: false, gatewayOrderCode: '1234561', gatewayPaymentLinkId: 'link' }],
    wallet: null, transactions: [], refunds: [], notifications: [], voucherMarks: 0,
  };
  revision = 0; emitted = []; dispatched = 0; failTransaction = false; failNotification = false; commits = 0; fallback = 0;
  beforeCommit = null;
  gateway = { id: 'link', status: 'PAID', amountPaid: 80000, transactions: [{ reference: 'ref' }] };
}
const mongoose = { startSession: async () => ({
  async withTransaction(work) {
    const version = revision; this.snapshot = copy(state);
    const result = await work(this);
    if (beforeCommit) { const action = beforeCommit; beforeCommit = null; action(); }
    if (version !== revision) throw Object.assign(new Error('Xung đột snapshot'), { code: 112 });
    if (failTransaction) throw new Error('Lỗi commit giả lập');
    state = this.snapshot; revision++; commits++;
    return result;
  }, async endSession() {},
}) };
const Payment = {
  find: filter => query(session => view(session).payments.filter(row => matches(row, filter)).map(row => document(row, 'payments', session))),
  findOne: filter => query(session => document(view(session).payments.find(row => matches(row, filter)), 'payments', session)),
  findById: id => query(session => document(view(session).payments.find(row => row._id === id), 'payments', session)),
  aggregate: () => query(session => [{ total: view(session).payments.filter(row => row.status === 'paid' && !row.isDeleted).reduce((sum, row) => sum + row.amount, 0) }]),
};
const Order = {
  findById: id => query(session => document(view(session).order?._id === id ? view(session).order : null, 'order', session)),
  findOneAndUpdate: (filter, update, options) => query(() => {
    const target = view(options.session);
    if (!matches(target.order, filter)) return null;
    target.order.__v = (target.order.__v ?? 0) + update.$inc.__v;
    return document(target.order, 'order', options.session);
  }),
};
const dependencies = {
  mongoose,
  '../utils/appError': { AppError },
  '../models/order.model': { Order }, '../models/payment.model': { Payment },
  '../models/promotion.model': {}, '../models/provider.model': {}, '../models/service.model': {},
  '../models/wallet.model': { Wallet: { findOneAndUpdate: async (filter, update, options) => {
    assert.equal(options.runValidators, true); assert.equal(filter.userId, 'khach');
    const target = view(options.session);
    target.wallet ??= { _id: 'vi', userId: 'khach', balance: 0 };
    target.wallet.balance += update.$inc.balance;
    return copy(target.wallet);
  } } },
  '../models/walletTransaction.model': { WalletTransaction: { create: async (rows, options) => {
    view(options.session).transactions.push(...copy(rows));
    if (failTransaction) throw new Error('Lỗi lưu lịch sử giả lập');
  } } },
  '../models/refund.model': { Refund: { updateOne: async (filter, update, options) => {
    assert.equal(options.runValidators, true);
    const target = view(options.session);
    if (!target.refunds.some(row => row.paymentId === filter.paymentId)) target.refunds.push(copy(update.$setOnInsert));
  } } },
  '../configs/payos.config': { payos: {
    paymentRequests: { get: async () => copy(gateway) },
    webhooks: { verify: async payload => { if (payload.invalid) throw new AppError('Chữ ký sai', 400); return payload; } },
  } },
  './notification.service': {
    createNotificationRecord: async (input, options = {}) => {
      if (failNotification) throw new Error('Lỗi thông báo giả lập');
      if (options.session) assert.equal(options.deferRealtime, true);
      const notification = { ...input, _id: 'thong-bao' };
      view(options.session).notifications.push(copy(notification)); return notification;
    },
    emitRealtimeNotification: row => { assert(commits > 0); emitted.push(row); },
  },
  './wallet.service': { handleWalletDepositPayosWebhook: async () => { fallback++; return { deposit: true }; } },
  './voucher.service': { markOrderVoucherAsUsed: async (order, session) => {
    if (order.voucherUsedAt) return;
    view(session).voucherMarks++;
    order.voucherUsedAt = new Date();
  } },
  '../utils/transaction': { withTransactionRetry, buildTransactionCode: () => 'KIEM_THU' },
  '../utils/logger': { createLogger: () => ({ error() {}, warn() {} }) },
  '../utils/actionPreconditionError': { ActionPreconditionError: AppError },
  './paymentStatus.service': { publishPaymentStatus() {} }, '../utils/paymentRedirect': {},
  './dispatch.service': { DispatchService: { dispatchReadyOrder: async () => { dispatched++; } } },
  './orderCancellation.service': { settleCancelledOrderPayments: async () => {} },
};
const context = { exports: {}, require(name) { assert(name in dependencies, name); return dependencies[name]; } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../services/payment.service'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, context);
const service = context.exports;
const webhook = extra => service.handlePayosWebhook({ orderCode: 1234561, paymentLinkId: 'link', amount: 80000, reference: 'ref', code: '00', ...extra });
const replacement = (method, status) => ({ _id: 'moi', orderId: 'don', customerId: 'khach', amount: 80000,
  paymentType: 'full', method, status, isDeleted: false });

async function main() {
  let notificationEmits = 0;
  class Notification {
    constructor(input) { Object.assign(this, input); this.$locals = {}; }
    static async create(rows) {
      // Mô phỏng hook post-save hiện có của model Notification.
      for (const row of rows) if (!row.$locals.deferRealtime) notificationEmits++;
      return rows;
    }
  }
  const notificationContext = { exports: {}, require(name) {
    const modules = {
      mongoose: {}, '../models/notification.model': { Notification }, '../models/user.model': {},
      '../models/order.model': {}, '../models/provider.model': {}, '../utils/appError': { AppError },
      '../utils/mongo': { toObjectId: value => value }, '../sockets/socketServer': { emitToUser: () => { notificationEmits++; } },
    };
    assert(name in modules, name); return modules[name];
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../services/notification.service'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, notificationContext);
  const notificationInput = { userId: 'khach', type: 'SYSTEM', title: 'Kiểm thử', content: 'Thông báo kiểm thử' };
  await notificationContext.exports.createNotificationRecord(notificationInput, { emitRealtime: true });
  assert.equal(notificationEmits, 1, 'Không phát lại thông báo đã được hook model phát.');
  await notificationContext.exports.createNotificationRecord(notificationInput, { emitRealtime: true, deferRealtime: true });
  assert.equal(notificationEmits, 1, 'Thông báo hoãn không được phát trước commit.');
  const indexes = require('../models/payment.model').Payment.schema.indexes();
  assert(indexes.some(([, options]) => options.name === 'order_payment_type_active_unique' && options.unique));
  for (const archived of [false, true]) {
    reset(); state.order.isDeleted = true; state.payments[0].isDeleted = archived;
    const result = await webhook();
    assert.equal(result.status, 'refunded'); assert.equal(result.isDeleted, false);
    assert.equal(state.wallet.balance, 80000); assert.equal(state.transactions.length, 1);
    assert.equal(state.refunds[0].status, 'succeeded'); assert.equal(state.order.isDeleted, true);
    assert.equal(state.order.status, 'created'); assert.equal(dispatched, 0); assert.equal(fallback, 0);
    assert.equal(emitted.length, 1);
    await webhook(); await webhook();
    assert.equal(state.wallet.balance, 80000); assert.equal(state.transactions.length, 1); assert.equal(emitted.length, 1);
  }
  for (const [method, status] of [['wallet', 'paid'], ['cash', 'pending'], ['payos', 'pending'], ['payos', 'paid']]) {
    reset(); state.payments.push(replacement(method, status));
    const before = copy(state.payments[1]);
    await Promise.all([webhook(), webhook()]);
    assert.deepEqual(state.payments[1], before); assert.equal(state.wallet.balance, 80000);
    assert.equal(state.transactions.length, 1); assert.equal(state.refunds.length, 1); assert.equal(dispatched, 0);
    assert.equal(state.order.paymentStatus, 'unpaid');
  }
  for (const extra of [{ invalid: true }, { amount: 1 }, { paymentLinkId: 'sai' }, { reference: undefined }]) {
    reset(); state.order.isDeleted = true;
    await assert.rejects(webhook(extra));
    assert.equal(state.wallet, null); assert.equal(state.transactions.length, 0);
  }
  reset();
  beforeCommit = () => {
    state.payments.push(replacement('wallet', 'paid')); state.order.paymentStatus = 'paid'; revision++;
  };
  await webhook();
  assert.equal(state.payments[0].status, 'refunded'); assert.equal(state.wallet.balance, 80000);
  assert.equal(state.order.paymentStatus, 'paid'); assert.equal(state.transactions.length, 1);
  assert.equal(dispatched, 0); assert.equal(emitted.length, 1);
  reset(); state.order.isDeleted = true; state.payments[0].gatewayTransactionId = 'ref-khac';
  await assert.rejects(webhook(), error => error.statusCode === 409);
  assert.equal(state.wallet, null);
  for (const notificationFailure of [false, true]) {
    reset(); state.order.isDeleted = true;
    failTransaction = !notificationFailure; failNotification = notificationFailure;
    await assert.rejects(webhook());
    assert.equal(state.wallet, null); assert.equal(state.payments[0].status, 'failed');
    assert.equal(state.transactions.length, 0); assert.equal(state.refunds.length, 0); assert.equal(emitted.length, 0);
  }
  reset(); await webhook();
  assert.equal(state.payments[0].status, 'paid'); assert.equal(state.wallet, null);
  assert.equal(state.order.paymentStatus, 'paid'); assert.equal(state.voucherMarks, 1);
  reset(); state.payments[0].status = 'pending';
  await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
  assert.equal(state.payments[0].status, 'paid'); assert.equal(state.voucherMarks, 1);
  reset();
  await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
  assert.equal(state.payments[0].status, 'paid', 'Đối soát khôi phục tiền đến muộn của QR failed.');
  assert.equal(state.order.paymentStatus, 'paid');
  assert.equal(state.voucherMarks, 1);
  for (const archived of [false, true]) {
    for (const method of ['wallet', 'cash', 'payos']) {
      reset(); state.payments[0].isDeleted = archived;
      state.payments.push(replacement(method, method === 'wallet' ? 'paid' : 'pending'));
      state.order.paymentStatus = method === 'wallet' ? 'paid' : 'unpaid';
      const expectedStatus = state.order.paymentStatus;
      // Đối soát QR thay thế cần trả dữ liệu của chính QR đó.
      if (method === 'payos') {
        state.payments[1].gatewayOrderCode = '1234562'; state.payments[1].gatewayPaymentLinkId = 'link-moi';
        dependencies['../configs/payos.config'].payos.paymentRequests.get = async code => code === 1234562
          ? { id: 'link-moi', status: 'PENDING', amountPaid: 0 } : copy(gateway);
      }
      await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
      assert.equal(state.payments[0].status, 'refunded'); assert.equal(state.wallet.balance, 80000);
      assert.equal(state.order.paymentStatus, expectedStatus);
      await webhook(); await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
      assert.equal(state.wallet.balance, 80000); assert.equal(state.transactions.length, 1);
      assert.equal(state.voucherMarks, 0);
    }
  }
  dependencies['../configs/payos.config'].payos.paymentRequests.get = async () => copy(gateway);
  reset(); gateway.status = 'CANCELLED'; gateway.amountPaid = 0;
  await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
  assert.equal(state.payments[0].status, 'failed'); assert.equal(state.wallet, null);
  for (const changes of [{ id: 'link-sai' }, { orderCode: 987654 }, { amount: 1 }, { amountPaid: 1 }, { transactions: [] }]) {
    reset(); Object.assign(gateway, changes);
    await assert.rejects(service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' }));
    assert.equal(state.payments[0].status, 'failed'); assert.equal(state.wallet, null);
  }
  reset(); failNotification = true;
  await assert.rejects(service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' }));
  assert.equal(state.payments[0].status, 'failed'); assert.equal(state.voucherMarks, 0);
  reset();
  await Promise.all([service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' }), webhook()]);
  assert.equal(state.payments[0].status, 'paid'); assert.equal(state.voucherMarks, 1);
  assert.equal(state.notifications.length, 1);
  reset(); state.payments.push(replacement('wallet', 'paid')); state.order.paymentStatus = 'paid';
  await Promise.all([service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' }), webhook()]);
  assert.equal(state.payments[0].status, 'refunded'); assert.equal(state.wallet.balance, 80000);
  assert.equal(state.transactions.length, 1); assert.equal(state.refunds.length, 1);
  reset(); state.order.isDeleted = true; state.payments[0].isDeleted = true;
  await service.reconcilePayosPaymentForExpiration('don');
  assert.equal(state.wallet.balance, 80000); assert.equal(state.order.isDeleted, true);
  reset();
  await webhook(); await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
  assert.equal(state.voucherMarks, 1);
  reset(); state.payments[0].status = 'paid';
  await service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' });
  assert.equal(state.voucherMarks, 1);
  reset(); state.payments[0].status = 'pending'; gateway.amountPaid = NaN;
  await assert.rejects(service.reconcilePayosPaymentForOrder('don', { id: 'khach', role: 'CUSTOMER' }));
  assert.equal(state.payments[0].status, 'pending');
  reset(); await assert.rejects(service.reconcilePayosPaymentForOrder('don', { id: 'nguoi-khac', role: 'CUSTOMER' }));
  assert.equal(state.payments[0].status, 'failed');
  console.log('Đạt: tiền QR đến muộn, hoàn ví nguyên tử, chống lặp/đồng thời, rollback, xác minh nguồn tiền và dùng voucher khi đối soát.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
