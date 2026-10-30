const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function load(relative, modules) {
  const filename = path.join(__dirname, '../src', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Number, Math, Map, Set, AbortSignal,
    setTimeout: () => ({ unref() {} }), require: name => modules[name] ?? {} }, { filename });
  return exports;
}
const query = value => ({ session() { return this; }, select() { return this; }, sort() { return this; },
  lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }

function setup(options = {}) {
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId(), availabilityStatus: options.availability ?? 'busy' };
  const customerId = new Types.ObjectId();
  const report = { _id: new Types.ObjectId(), status: options.reportStatus ?? 'pending', reporterId: provider.userId,
    noShowVerification: { decision: 'auto_eligible' } };
  const evidence = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
  const order = { _id: new Types.ObjectId(), orderCode: 'DON-THU-NGHIEM', customerId, providerId: provider._id,
    status: options.status ?? 'accepted', isDeleted: false, orderType: 'normal', paymentStatus: options.paid ? 'paid' : 'unpaid',
    arrival: { providerId: provider._id, arrivedAt: new Date(Date.now() - 11 * 60000) },
    customerNoShow: { reportId: report._id, status: 'pending', compensationAmount: 5000, evidenceIds: evidence.map(item => item._id) },
  };
  const providerWallet = { _id: new Types.ObjectId(), balance: 100000 };
  const customerWallet = { _id: new Types.ObjectId(), balance: 20000 };
  const payment = { _id: new Types.ObjectId(), customerId, method: 'wallet', status: 'paid', amount: 100000 };
  const ledger = [];
  const session = { async withTransaction(fn) {
    const snapshot = { status: order.status, noShow: { ...order.customerNoShow }, report: report.status,
      providerBalance: providerWallet.balance, customerBalance: customerWallet.balance,
      paymentStatus: payment.status, availability: provider.availabilityStatus, count: ledger.length };
    try { return await fn(session); }
    catch (error) {
      order.status = snapshot.status; order.customerNoShow = snapshot.noShow; report.status = snapshot.report;
      providerWallet.balance = snapshot.providerBalance; customerWallet.balance = snapshot.customerBalance;
      payment.status = snapshot.paymentStatus; provider.availabilityStatus = snapshot.availability;
      ledger.length = snapshot.count; delete order.cancellation;
      throw error;
    }
  }, async endSession() {} };
  const modules = {
    mongoose: { __esModule: true, Types, default: { startSession: async () => session } },
    crypto: require('node:crypto'), '../utils/appError': { AppError },
    '../utils/actionPreconditionError': { ActionPreconditionError: AppError },
    '../utils/logger': { createLogger: () => ({ error() {}, info() {}, warn() {} }) },
    '../utils/transaction': { withTransactionRetry: (current, fn) => current.withTransaction(fn), buildTransactionCode: () => 'HOAN-THU-NGHIEM' },
    '../models/order.model': { Order: {
      findById: () => query(order),
      exists: () => query(options.otherWork ?? false),
      async findOneAndUpdate(filter, update) {
        if (options.failCancel) throw new Error('Lỗi ghi hủy đơn');
        if (order.status !== filter.status) return null;
        Object.assign(order, update.$set); return order;
      },
      async updateOne(_, update) { Object.assign(order, update.$set); },
    } },
    '../models/provider.model': { Provider: {
      findById: () => query(provider), findOne: () => query(provider),
      async updateOne(filter, update) {
        if (!filter.availabilityStatus || provider.availabilityStatus === filter.availabilityStatus) Object.assign(provider, update.$set);
      },
    } },
    '../models/report.model': { Report: {
      async findOneAndUpdate(filter, update) {
        if (options.reportChanged || !filter.status.$in.includes(report.status)) return null;
        Object.assign(report, update.$set); return report;
      },
    } },
    '../models/wallet.model': { Wallet: { async findOneAndUpdate(filter, update) {
      const wallet = String(filter.userId) === String(provider.userId) ? providerWallet : customerWallet;
      wallet.balance += update.$inc.balance; return wallet;
    } } },
    '../models/walletTransaction.model': { WalletTransaction: {
      findOne: filter => query(ledger.find(item => item.type === filter.type && String(item.relatedPaymentId) === String(filter.relatedPaymentId)) ?? null),
      async create(items) { if (options.failLedger) throw new Error('Lỗi ghi sổ ví'); ledger.push(...items); return items; },
    } },
    '../models/payment.model': { Payment: {
      find: filter => query(options.paid && (!filter.method || filter.method === payment.method)
        && (filter.status === payment.status || filter.status?.$in?.includes(payment.status)) ? [payment] : []),
      exists: filter => query(options.paid && filter.status === payment.status ? payment : null),
      async findOneAndUpdate(filter, update) { if (filter.status !== payment.status) return null; Object.assign(payment, update.$set); return payment; },
      async updateMany() {}, async updateOne(_, update) { Object.assign(payment, update.$set); },
    } },
    '../models/orderAssignment.model': { OrderAssignment: { async updateMany() {} } },
    './providerSchedule.service': { lockProviderSchedule: async () => provider },
    '../models/customerNoShowEvidence.model': { CustomerNoShowEvidence: { find: () => query(evidence) } },
    './customerNoShowVerification.service': { verifyNoShowEvidence: async () => ({ decision: options.verificationChanged ? 'manual_review' : 'auto_eligible' }) },
    './voucher.service': { releaseVoucherReservation: async () => {} },
    './promotion.service': { releaseOrderPromotion: async () => {} },
    './systemConfig.service': { getRefundPolicy: async () => ({ providerCompensationPercent: 80 }),
      getOrderOperationPolicy: async () => ({ customerNoShowWaitMinutes: 10, customerCancellationMinutes: 5 }) },
    './notification.service': { createNotificationRecord: async () => {} },
    '../sockets/socketServer': { emitToUser() {} },
    '../validations/refundPolicy.validator': { DEFAULT_REFUND_POLICY: { providerCompensationPercent: 80 } },
  };
  modules['../utils/customerNoShow'] = load('utils/customerNoShow.ts', modules);
  modules['./providerPresence.service'] = load('services/providerPresence.service.ts', modules);
  modules['./customerNoShowSettlement.service'] = load('services/customerNoShowSettlement.service.ts', modules);
  modules['./refundPolicy.service'] = load('services/refundPolicy.service.ts', modules);
  const cancellation = load('services/orderCancellation.service.ts', modules);
  const input = { orderId: String(order._id), actorId: String(new Types.ObjectId()), role: 'admin',
    reason: 'Khách không có mặt sau 10 phút.', customerNoShowReview: { reportId: String(report._id) } };
  return { order, report, provider, providerWallet, customerWallet, ledger, payment, input,
    approve: () => cancellation.cancelOrderWithSettlement(input), cancellation };
}

for (const paid of [false, true]) {
  test(`Duyệt báo cáo ${paid ? 'đã thanh toán ví' : 'tiền mặt'}: hủy đơn, hỗ trợ đúng 5.000đ một lần và không thu thêm khách`, async () => {
    const ctx = setup({ paid });
    await ctx.approve();
    assert.equal(ctx.order.status, 'cancelled');
    assert.equal(ctx.order.cancellation.cancelledByRole, 'admin');
    assert.equal(ctx.order.cancellation.refundPolicy.refundRate, 100);
    assert.equal(ctx.order.cancellation.refundPolicy.cancellationFee, 0);
    assert.equal(ctx.order.customerNoShow.status, 'approved');
    assert.equal(ctx.report.status, 'confirmed');
    assert.equal(ctx.providerWallet.balance, 105000);
    assert.equal(ctx.customerWallet.balance, paid ? 120000 : 20000);
    assert.equal(ctx.provider.availabilityStatus, 'online');
    assert.equal(ctx.ledger.filter(item => item.metadata.source === 'customer_no_show_support').length, 1);
    await ctx.approve();
    assert.equal(ctx.providerWallet.balance, 105000);
    assert.equal(ctx.customerWallet.balance, paid ? 120000 : 20000);
    assert.equal(ctx.ledger.filter(item => item.metadata.source === 'customer_no_show_support').length, 1);
  });
}
for (const failure of ['failLedger', 'failCancel', 'reportChanged']) {
  test(`Giao dịch rollback khi ${failure}, không cộng ví hoặc xác nhận báo cáo nửa chừng`, async () => {
    const ctx = setup({ [failure]: true });
    await assert.rejects(ctx.approve());
    assert.equal(ctx.order.status, 'accepted');
    assert.equal(ctx.order.customerNoShow.status, 'pending');
    assert.equal(ctx.report.status, 'pending');
    assert.equal(ctx.providerWallet.balance, 100000);
    assert.equal(ctx.ledger.length, 0);
  });
}
for (const options of [{ otherWork: true }, { availability: 'offline' }]) {
  test(`Không ghi đè trạng thái thợ: ${JSON.stringify(options)}`, async () => {
    const ctx = setup(options);
    await ctx.approve();
    assert.equal(ctx.provider.availabilityStatus, options.availability ?? 'busy');
  });
}
test('Chặn khách/thợ tự duyệt và chặn duyệt đơn đã bắt đầu', async () => {
  const ctx = setup();
  await assert.rejects(ctx.cancellation.cancelOrderWithSettlement({ ...ctx.input, role: 'provider' }), /Chỉ quản trị viên/);
  assert.equal(ctx.providerWallet.balance, 100000);
  const active = setup({ status: 'in_progress' });
  await assert.rejects(active.approve(), /Không thể hủy/);
  assert.equal(active.report.status, 'pending');
  assert.equal(active.providerWallet.balance, 100000);
});

test('Hệ thống tự duyệt ghi đúng nguồn, không giả mạo admin và chỉ cộng một lần', async () => {
  const ctx = setup();
  delete ctx.input.actorId; ctx.input.system = true; ctx.input.customerNoShowReview.automated = true;
  await ctx.approve();
  assert.equal(ctx.providerWallet.balance, 105000);
  assert.equal(ctx.report.reviewedByType, 'system');
  assert.equal(ctx.report.handledBy, null);
  assert.equal(ctx.ledger[0].metadata.approvedByType, 'system');
  assert.equal(ctx.ledger[0].metadata.approvedBy, null);
  await ctx.approve();
  assert.equal(ctx.providerWallet.balance, 105000);
});

for (const options of [{ verificationChanged: true }, { reportStatus: 'under_review' }]) {
  test(`Dữ liệu thay đổi hoặc admin đã nhận xử lý thì dừng tự duyệt: ${JSON.stringify(options)}`, async () => {
    const ctx = setup(options);
    delete ctx.input.actorId; ctx.input.system = true; ctx.input.customerNoShowReview.automated = true;
    await assert.rejects(ctx.approve());
    assert.equal(ctx.providerWallet.balance, 100000);
    assert.equal(ctx.order.status, 'accepted');
    assert.equal(ctx.ledger.length, 0);
  });
}

test('Không cho giả cờ tự duyệt trên thao tác của thợ hoặc admin thông thường', async () => {
  const ctx = setup();
  ctx.input.customerNoShowReview.automated = true;
  await assert.rejects(ctx.approve(), /luồng xác minh hệ thống/);
  ctx.input.role = 'provider'; delete ctx.input.actorId; ctx.input.system = true;
  await assert.rejects(ctx.approve(), /luồng xác minh hệ thống/);
  assert.equal(ctx.providerWallet.balance, 100000);
});
