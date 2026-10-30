const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

// Chạy service thật với database và cổng thanh toán giả, không nạp cấu hình bí mật.
function load(name, modules = {}) {
  const filename = path.join(__dirname, '../src/services', `${name}.ts`);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Map, Set, require(name) {
    if (name in modules) return modules[name];
    if (name === 'crypto' || name === 'node:crypto') return require(name);
    if (name === '../utils/appError' || name === '../utils/actionPreconditionError') {
      return { AppError: Error, ActionPreconditionError: Error };
    }
    if (name === '../utils/logger') return { createLogger: () => ({ info() {}, warn() {}, error() {} }) };
    if (name === '../validations/refundPolicy.validator') return { DEFAULT_REFUND_POLICY: { providerCompensationPercent: 80 } };
    return {};
  } }, { filename });
  return exports;
}

const policy = load('refundPolicy.service');
const query = value => ({ select() { return this; }, sort() { return this; }, session() { return this; },
  lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const valueAt = (value, key) => key.split('.').reduce((item, part) => item?.[part], value);
function matches(value, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = valueAt(value, key);
    if (expected && Array.isArray(expected.$in)) return expected.$in.includes(actual);
    return expected == null ? actual == null : String(actual) === String(expected);
  });
}
function set(value, fields = {}) {
  for (const [key, entry] of Object.entries(fields)) {
    const parts = key.split('.');
    const field = parts.pop();
    const parent = parts.reduce((item, part) => item[part] ??= {}, value);
    parent[field] = entry;
  }
}

function setup({ method = 'wallet', inspection = false, arrived = true, quotation = false, amounts,
  status = 'accepted', pendingReport = false, staleArrival = false, failLedger = false } = {}) {
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId(), availabilityStatus: 'busy' };
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: provider._id,
    orderCode: 'HD-DEN-NOI', orderType: 'normal', status, isDeleted: false, inspectionRequired: inspection,
    paymentMethod: method === 'payos' ? 'bank' : method, paymentStatus: method === 'cash' ? 'unpaid' : 'paid',
    currentQuotationId: quotation ? new Types.ObjectId() : null,
    ...(pendingReport ? { customerNoShow: { status: 'pending' } } : {}),
    arrival: arrived ? { providerId: staleArrival ? new Types.ObjectId() : provider._id, arrivedAt: new Date() } : null };
  const payments = (amounts ?? [inspection ? 20000 : 120000]).map(amount => ({
    _id: new Types.ObjectId(), orderId: order._id, customerId: order.customerId, amount, method,
    paymentType: inspection ? 'inspection_deposit' : 'full', status: method === 'cash' ? 'pending' : 'paid',
    isDeleted: false, metadata: {}, compensatedToProviderId: null,
  }));
  const customerWallet = { _id: new Types.ObjectId(), balance: 10000 };
  const providerWallet = { _id: new Types.ObjectId(), balance: 100000, async save(options) { assert.equal(options.session, session); } };
  const entries = [], refunds = [], notices = [];
  let reassignments = 0;
  const session = { async withTransaction(run) {
    const previousOrder = { ...order };
    const previousPayments = payments.map(payment => ({ ...payment, metadata: { ...payment.metadata } }));
    const balances = [customerWallet.balance, providerWallet.balance], length = entries.length, refundCount = refunds.length;
    try { return await run(); } catch (error) {
      for (const key of Object.keys(order)) if (!(key in previousOrder)) delete order[key];
      Object.assign(order, previousOrder);
      payments.forEach((payment, index) => Object.assign(payment, previousPayments[index]));
      [customerWallet.balance, providerWallet.balance] = balances;
      entries.length = length;
      refunds.length = refundCount;
      throw error;
    }
  }, async endSession() {} };
  const checkSession = options => assert.equal(options.session, session);
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    './refundPolicy.service': policy,
    './systemConfig.service': { getRefundPolicy: async () => ({ providerCompensationPercent: 80 }),
      getOrderOperationPolicy: async () => ({ customerCancellationMinutes: 5 }) },
    '../utils/transaction': { buildTransactionCode: prefix => `${prefix}_${entries.length}`,
      withTransactionRetry: (current, run) => current.withTransaction(() => run(current)) },
    '../models/order.model': { Order: {
      findById: () => query(order),
      async findOneAndUpdate(filter, update, options) {
        checkSession(options);
        if (!matches(order, filter)) return null;
        set(order, update.$set); return order;
      },
      async updateOne(filter, update) { if (matches(order, filter)) set(order, update.$set); },
    } },
    '../models/provider.model': { Provider: {
      findOne: filter => query(matches(provider, filter) ? provider : null),
      findById: () => query(provider),
      async updateOne(_, update, options) { checkSession(options); set(provider, update.$set); },
    } },
    '../models/payment.model': { Payment: {
      find: filter => query(payments.filter(payment => matches(payment, filter))),
      exists: filter => query(payments.some(payment => matches(payment, filter))),
      async findOneAndUpdate(filter, update, options) {
        checkSession(options);
        const payment = payments.find(payment => matches(payment, filter));
        if (!payment) return null;
        set(payment, update.$set); return payment;
      },
      async updateOne(filter, update, options) {
        checkSession(options);
        const payment = payments.find(payment => matches(payment, filter));
        if (payment?.metadata === null && Object.keys(update.$set).some(key => key.startsWith('metadata.'))) {
          throw new Error('Không thể cập nhật trường con khi metadata là null.');
        }
        if (payment) set(payment, update.$set);
      },
      async updateMany(filter, update, options) {
        checkSession(options);
        payments.filter(payment => matches(payment, filter)).forEach(payment => set(payment, update.$set));
      },
    } },
    '../models/wallet.model': { Wallet: {
      findOne: filter => query(String(filter.userId) === String(provider.userId) ? providerWallet : customerWallet),
      async findOneAndUpdate(filter, update, options) {
        checkSession(options);
        const wallet = String(filter.userId) === String(provider.userId) ? providerWallet : customerWallet;
        wallet.balance += update.$inc.balance; return wallet;
      },
    } },
    '../models/walletTransaction.model': { WalletTransaction: {
      findOne: filter => query(entries.find(entry => matches(entry, filter)) ?? null),
      async create(items, options) {
        checkSession(options);
        if (failLedger && items.some(item => String(item.userId) === String(provider.userId))) {
          throw new Error('Không ghi được giao dịch hỗ trợ thợ.');
        }
        entries.push(...items);
      },
    } },
    '../models/refund.model': { Refund: {
      findOne: filter => query(refunds.find(refund => matches(refund, filter)) ?? null),
      async updateOne(filter, update, options) {
        checkSession(options);
        let refund = refunds.find(refund => matches(refund, filter));
        if (!refund) { refund = { ...filter, ...update.$setOnInsert }; refunds.push(refund); }
        set(refund, update.$set);
      },
    } },
    '../models/orderAssignment.model': { OrderAssignment: { async updateMany(_, __, options) { checkSession(options); } } },
    './voucher.service': { async releaseVoucherReservation() {} },
    './promotion.service': { async releaseOrderPromotion() {} },
    './notification.service': { async createNotificationRecord(value) { notices.push(value); } },
    '../sockets/socketServer': { emitToUser() {} },
    '../configs/payos.config': { payos: { paymentRequests: { get() { assert.fail('Không gọi cổng QR cho khoản đã hoàn về ví'); } } },
      payoutPayos: { payouts: { create() { assert.fail('Không tạo lệnh chi ngân hàng'); } } } },
    './orderReassignment.service': { async requestProviderReassignment() { reassignments++; return order; } },
  };
  // Truy vấn hồ sơ hiện có luôn lọc isDeleted: false.
  provider.isDeleted = false;
  const cancellation = load('orderCancellation.service', modules);
  const orders = load('order.service', { ...modules, './orderCancellation.service': cancellation });
  return { order, provider, payments, customerWallet, providerWallet, entries, refunds, notices, modules, cancellation,
    allowLedger: () => { failLedger = false; },
    reassignments: () => reassignments,
    cancel: (reason = 'Không thể thực hiện dịch vụ', actor = provider.userId.toString()) =>
      orders.OrderService.cancelOrder(order._id.toString(), actor, 'provider', reason) };
}

for (const inspection of [false, true]) for (const method of ['wallet', 'payos']) for (const quotation of inspection ? [false, true] : [false]) {
  test(`${inspection ? 'Báo giá' : 'Giá cố định'} ${method}, đã có báo giá ${quotation}: hoàn đúng tiền trừ 5.000đ, cộng ví thợ một lần`, async () => {
    const ctx = setup({ inspection, method, quotation });
    await ctx.cancel('Lý do bất kỳ: khách thay đổi nhu cầu');
    assert.equal(ctx.order.status, 'cancelled');
    assert.equal(ctx.order.readyForMatching, false);
    assert.equal(ctx.reassignments(), 0);
    assert.equal(ctx.customerWallet.balance, 10000 + (inspection ? 15000 : 115000));
    assert.equal(ctx.providerWallet.balance, 105000);
    assert.equal(ctx.order.cancellation.refundPolicy.providerCompensation, 5000);
    assert.equal(ctx.payments[0].status, 'refunded');
    if (method === 'payos') {
      assert.equal(ctx.refunds[0].amount, inspection ? 15000 : 115000);
      assert.equal(ctx.refunds[0].destination, 'handigo_wallet');
    }
    const entryCount = ctx.entries.length;
    await ctx.cancel('Gửi lại yêu cầu hủy');
    await ctx.cancellation.settleCancelledOrderPayments(ctx.order._id, 'Đối soát lại');
    assert.equal(ctx.providerWallet.balance, 105000);
    assert.equal(ctx.entries.length, entryCount);
  });
}

test('Tiền mặt chưa thu: Handigo cộng 5.000đ, không hoàn tiền và không thay thợ', async () => {
  const ctx = setup({ method: 'cash' });
  await ctx.cancel();
  await ctx.cancel();
  assert.equal(ctx.providerWallet.balance, 105000);
  assert.equal(ctx.customerWallet.balance, 10000);
  assert.equal(ctx.payments[0].status, 'failed');
  assert.equal(ctx.entries.length, 1);
  assert.equal(ctx.entries[0].metadata.fundedBy, 'platform');
  assert.equal(ctx.reassignments(), 0);
});

test('Nhiều khoản thanh toán: tổng phí đúng 5.000đ, không mất tiền do làm tròn', async () => {
  const ctx = setup({ amounts: [3333, 116668] });
  await ctx.cancel();
  assert.equal(ctx.customerWallet.balance, 125001);
  assert.equal(ctx.providerWallet.balance, 105000);
  assert.equal(ctx.entries.filter(entry => entry.type === 'refund').reduce((sum, entry) => sum + entry.amount, 0), 115001);
});

test('Thanh toán ví có metadata null vẫn hoàn tiền được; metadata hiện có được giữ nguyên', async () => {
  for (const metadata of [null, { actualAmountPaid: 120000, note: 'Thanh toán gốc' }]) {
    const ctx = setup();
    ctx.payments[0].metadata = metadata;
    await ctx.cancel();
    assert.equal(ctx.customerWallet.balance, 125000);
    assert.equal(ctx.providerWallet.balance, 105000);
    if (metadata) assert.equal(ctx.payments[0].metadata.note, metadata.note);
  }
});

for (const options of [{ arrived: false }, { staleArrival: true }]) {
  test(`Chưa xác nhận đến nơi của thợ hiện tại giữ luồng thay thợ cũ: ${JSON.stringify(options)}`, async () => {
    const ctx = setup(options);
    await ctx.cancel();
    assert.equal(ctx.reassignments(), 1);
    assert.equal(ctx.providerWallet.balance, 100000);
    assert.equal(ctx.entries.length, 0);
  });
}

test('Thợ khác không được hủy hoặc nhận tiền hỗ trợ', async () => {
  const ctx = setup();
  await assert.rejects(ctx.cancel('Lý do bất kỳ', new Types.ObjectId().toString()), /quyền/);
  assert.equal(ctx.order.status, 'accepted');
  assert.equal(ctx.entries.length, 0);
});

test('Báo cáo khách vắng mặt đang chờ không được nhận hỗ trợ lần hai qua hủy yêu cầu', async () => {
  const ctx = setup({ pendingReport: true });
  await assert.rejects(ctx.cancel(), /chờ xử lý/);
  assert.equal(ctx.entries.length, 0);
});

for (const status of ['in_progress', 'completed']) {
  test(`${status}: không mở rộng quyền hủy sau khi đã bắt đầu hoặc hoàn thành`, async () => {
    const ctx = setup({ status });
    await assert.rejects(ctx.cancel(), /Không thể hủy/);
    assert.equal(ctx.entries.length, 0);
  });
}

for (const method of ['wallet', 'payos', 'cash']) {
  test(`${method}: lỗi ghi hỗ trợ rollback cả hủy và tiền hoàn; thử lại chỉ quyết toán một lần`, async () => {
    const ctx = setup({ method, failLedger: true });
    await assert.rejects(ctx.cancel(), /Không ghi được/);
    assert.equal(ctx.order.status, 'accepted');
    assert.equal(ctx.customerWallet.balance, 10000);
    assert.equal(ctx.providerWallet.balance, 100000);
    assert.equal(ctx.payments[0].status, method === 'cash' ? 'pending' : 'paid');
    assert.equal(ctx.entries.length, 0);
    assert.equal(ctx.refunds.length, 0);
    ctx.allowLedger();
    await ctx.cancel();
    await ctx.cancel();
    assert.equal(ctx.providerWallet.balance, 105000);
    assert.equal(ctx.customerWallet.balance, method === 'cash' ? 10000 : 125000);
  });
}

test('Chặn trợ cấp sai cho khoản QR/cọc chưa được xác nhận thanh toán', async () => {
  const ctx = setup({ method: 'payos', inspection: true });
  ctx.payments[0].status = 'pending';
  await assert.rejects(ctx.cancel(), /đối soát thanh toán/);
  assert.equal(ctx.order.status, 'accepted');
  assert.equal(ctx.entries.length, 0);
});

test('Lượt đọc trong transaction thấy thợ đã đến thì hủy và quyết toán, không điều phối lại', async () => {
  const ctx = setup();
  const reassignment = load('orderReassignment.service', { ...ctx.modules,
    './orderCancellation.service': ctx.cancellation,
    './dispatch.service': { getMaxMatchingDurationSeconds: async () => 360,
      DispatchService: { dispatchReadyOrder() { assert.fail('Không tìm thợ mới sau khi đã đến nơi'); } } },
  });
  await reassignment.requestProviderReassignment(ctx.order._id.toString(), ctx.provider.userId.toString(), 'Lịch hẹn không còn phù hợp');
  assert.equal(ctx.order.status, 'cancelled');
  assert.equal(ctx.customerWallet.balance, 125000);
  assert.equal(ctx.providerWallet.balance, 105000);
});

test('Đơn hẹn giờ sau khi đến nơi cũng áp dụng mọi lý do, không chuyển toàn bộ cọc cho thợ', async () => {
  const ctx = setup({ inspection: true, quotation: true });
  ctx.order.orderType = 'scheduled';
  ctx.order.scheduledAt = new Date();
  await ctx.cancel('Khách hàng không đồng ý báo giá: thay đổi nhu cầu');
  assert.equal(ctx.customerWallet.balance, 25000);
  assert.equal(ctx.providerWallet.balance, 105000);
  assert.equal(ctx.reassignments(), 0);
});
