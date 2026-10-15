const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { Types } = mongoose;

function loadService(name, modules, internals = []) {
  const file = path.join(__dirname, '../src/services', name + '.ts');
  const source = fs.readFileSync(file, 'utf8')
    + internals.map(name => `\nexport { ${name} };`).join('');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date, Map, AbortSignal, setTimeout: () => ({ unref() {} }),
    require(name) {
      if (name in modules) return modules[name];
      if (name === 'crypto' || name === 'node:crypto') return require(name);
      if (name === '../utils/appError' || name === '../utils/actionPreconditionError') {
        return { AppError: Error, ActionPreconditionError: Error };
      }
      if (name === '../utils/logger') return { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) };
      // Chỉ nạp các module được giả lập, không chạm cấu hình hoặc database thật.
      return {};
    },
  }, { filename: file });
  return exports;
}

function query(value) {
  return { select() { return this; }, sort() { return this; }, session() { return this; }, lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

function setFields(target, fields) {
  for (const [key, value] of Object.entries(fields ?? {})) {
    const parts = key.split('.');
    const field = parts.pop();
    let node = target;
    for (const part of parts) node = node[part] ??= {};
    node[field] = value;
  }
}

function reassignmentSetup(orderType = 'normal') {
  const providerId = new Types.ObjectId();
  const events = [];
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(),
    providerId, status: 'accepted', orderType, orderCode: 'ORD-THAYTHE',
    inspectionRequired: false, readyForMatching: false, bookingStatus: 'confirmed',
    matchingStartedAt: new Date(0), matchingSearch: { expiresAt: new Date(0) } };
  const session = { async withTransaction(fn) { await fn(); events.push('commit'); }, async endSession() {} };
  const service = loadService('orderReassignment.service', {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../models/order.model': { Order: {
      findById: () => query(order),
      async findOneAndUpdate(filter, update) { setFields(order, update.$set); return order; },
    } },
    '../models/provider.model': { Provider: {
      findOne: () => query({ _id: providerId }), async updateOne() {},
    } },
    '../models/orderAssignment.model': { OrderAssignment: { async updateOne() {} } },
    './dispatch.service': { getMaxMatchingDurationSeconds: async () => 360,
      DispatchService: { async dispatchReadyOrder() { events.push('dispatch'); } } },
    './notification.service': { async createNotificationRecord(input) { events.push(input); } },
    '../sockets/socketServer': { emitToUser() { events.push('emit'); } },
  });
  return { order, providerId, events, cancel: () => service.requestProviderReassignment(
    order._id.toString(), new Types.ObjectId().toString(), 'Không thể đến thực hiện dịch vụ',
  ) };
}

for (const type of ['normal', 'urgent', 'scheduled', 'recurring']) {
  test(`Thợ hủy đơn ${type}: tự tìm thợ, làm mới thời hạn và chỉ phát sau commit`, async () => {
    const context = reassignmentSetup(type);
    const started = Date.now();
    await context.cancel();
    assert.equal(context.order.status, 'created');
    assert.equal(context.order.providerId, null);
    assert.equal(context.order.reassignment.status, 'matching');
    assert.equal(context.order.reassignment.automatic, true);
    assert.equal(context.order.readyForMatching, true);
    assert.equal(context.order.matchingSearch, null);
    assert.ok(context.order.reassignment.expiresAt.getTime() >= started + 360000);
    assert.ok(context.events.indexOf('dispatch') > context.events.indexOf('commit'));
    assert.equal(context.events.find(event => typeof event === 'object').data.action, 'order_reassignment_matching');
    await context.cancel();
    assert.equal(context.events.filter(event => event === 'dispatch').length, 1);
  });
}

test('Giữ danh sách tất cả thợ đã hủy qua nhiều lần thay thế', async () => {
  const context = reassignmentSetup();
  const firstProvider = new Types.ObjectId();
  context.order.reassignment = { previousProviderIds: [firstProvider] };
  await context.cancel();
  assert.deepEqual(Array.from(context.order.reassignment.previousProviderIds, String), [firstProvider, context.providerId].map(String));
});

test('Không đổi luồng đơn báo giá hoặc cho thợ khác hủy đơn', async () => {
  const quotation = reassignmentSetup();
  quotation.order.inspectionRequired = true;
  await assert.rejects(quotation.cancel(), /báo giá/);
  const stranger = reassignmentSetup();
  stranger.order.providerId = new Types.ObjectId();
  await assert.rejects(stranger.cancel(), /quyền/);
});

function cancellationSetup(method = 'wallet', { automatic = true, unavailable = true, status = 'created',
  customer = false, inspectionRequired = false, acceptedAt = new Date(Date.now() - 60000) } = {}) {
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), orderCode: 'ORD-HOANTIEN',
    status, orderType: 'normal', paymentMethod: method === 'payos' ? 'bank' : method,
    providerId: customer ? new Types.ObjectId() : null, inspectionRequired, paymentStatus: method === 'cash' ? 'unpaid' : 'paid',
    reassignment: { automatic, status: 'matching' } };
  const payment = { _id: new Types.ObjectId(), orderId: order._id, customerId: order.customerId,
    method, status: method === 'cash' ? 'pending' : 'paid', amount: 180000, async save() {} };
  const transactions = [], vouchers = [], notifications = [];
  const wallet = { _id: new Types.ObjectId(), balance: 20000, async save() {} };
  let refund;
  const session = { async withTransaction(fn) { return fn(); }, async endSession() {} };
  const models = {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../models/order.model': { Order: {
      findById: () => query(order),
      findOne: () => query(order),
      async findOneAndUpdate(_, update) { setFields(order, update.$set); return order; },
      async updateOne(_, update) { setFields(order, update.$set); },
    } },
    '../models/orderStatus.model': { OrderStatus: { findOne: () => query(acceptedAt ? { createdAt: acceptedAt } : null) } },
    '../models/provider.model': { Provider: {
      async updateOne() {}, findById: () => query({ userId: new Types.ObjectId() }),
    } },
    '../models/payment.model': { Payment: {
      find(filter) {
        const matches = (!filter.method || (typeof filter.method === 'string'
          ? filter.method === payment.method : filter.method.$in.includes(payment.method)))
          && (!filter.status || (typeof filter.status === 'string' ? filter.status === payment.status : filter.status.$in.includes(payment.status)));
        return query(matches ? [payment] : []);
      },
      findById: () => query(payment),
      exists: filter => query(filter.status === payment.status),
      async findOneAndUpdate(filter, update) {
        if (filter.status && filter.status !== payment.status) return null;
        setFields(payment, update.$set); return payment;
      },
      async updateOne(_, update) { setFields(payment, update.$set); },
      async updateMany(filter, update) {
        if (payment.method === filter.method && payment.status === filter.status) setFields(payment, update.$set);
      },
    } },
    '../models/wallet.model': { Wallet: {
      findOne: () => query(wallet),
      async findOneAndUpdate(_, update) { wallet.balance += update.$inc.balance; return wallet; },
    } },
    '../models/walletTransaction.model': { WalletTransaction: {
      findOne: () => query(transactions[0] ?? null), async create(items) { transactions.push(...items); },
    } },
    '../models/voucher.model': { Voucher: { async updateOne(filter, update, options) {
      assert.equal(options.session, session); vouchers.push(update.$setOnInsert);
    } } },
    '../models/orderAssignment.model': { OrderAssignment: { async updateMany() {}, findOne: () => query(null) } },
    '../models/refund.model': { Refund: {
      async findOneAndUpdate(_, update) {
        refund ??= { _id: new Types.ObjectId(), ...update.$setOnInsert };
        setFields(refund, update.$set); return refund;
      },
      async updateOne(_, update) { setFields(refund, update.$set); },
    } },
    './voucher.service': { async releaseVoucherReservation() {} },
    './promotion.service': { async releaseOrderPromotion() {} },
    './refundPolicy.service': loadService('refundPolicy.service', {}),
    '../utils/transaction': { buildTransactionCode: () => 'REFUND-THU-NGHIEM' },
    './notification.service': { async createNotificationRecord(value) { notifications.push(value); } },
    '../sockets/socketServer': { emitToUser() {} },
    '../configs/payos.config': {
      payos: { paymentRequests: { get() { assert.fail('Không được gọi PayOS khi hoàn QR về ví'); } } },
      payoutPayos: { payouts: { list() { assert.fail('Không được tạo payout ngân hàng'); } } },
    },
  };
  const service = loadService('orderCancellation.service', models);
  return { order, payment, wallet, vouchers, transactions, notifications,
    service,
    cancel: () => customer
      ? service.cancelOrderWithSettlement({ orderId: order._id.toString(), actorId: order.customerId.toString(), role: 'customer', reason: 'Khách thay đổi kế hoạch' })
      : service.cancelSystemOrderWithSettlement(order._id.toString(), 'Hết thời gian tìm thợ', unavailable ? 'provider_unavailable' : undefined) };
}

for (const method of ['wallet', 'payos', 'cash']) {
  test(`Hết thời gian thay thợ, ${method}: cấp mã một lần, hoàn đúng tiền về ví và không tạo payout`, async () => {
    const context = cancellationSetup(method);
    await context.cancel();
    assert.equal(context.order.status, 'cancelled');
    assert.equal(context.order.reassignment.status, 'failed');
    assert.equal(context.vouchers.length, 1);
    const voucher = context.vouchers[0];
    assert.equal(voucher.ownerId, context.order.customerId);
    assert.equal(voucher.discountType, 'PERCENT');
    assert.equal(voucher.discountValue, 10);
    assert.equal(voucher.minOrderAmount, 0);
    assert.equal(voucher.maxDiscountAmount, null);
    assert.equal(voucher.neverExpires, true);
    assert.equal(voucher.usageLimit, 1);
    assert.equal(context.wallet.balance, method === 'cash' ? 20000 : 200000);
    assert.equal(context.transactions.length, method === 'cash' ? 0 : 1);
    assert.equal(context.payment.status, method === 'cash' ? 'failed' : 'refunded');
    await context.cancel();
    assert.equal(context.vouchers.length, 1);
    assert.equal(context.wallet.balance, method === 'cash' ? 20000 : 200000);
  });
}

test('Không tặng mã cho lần tìm thợ ban đầu hoặc khách chủ động hủy', async () => {
  for (const options of [{ automatic: false }, { unavailable: false }]) {
    const context = cancellationSetup('cash', options);
    await context.cancel();
    assert.equal(context.vouchers.length, 0);
  }
});

test('Thợ đã nhận đúng lúc quét hết hạn: giữ đơn và không cấp mã/hoàn tiền', async () => {
  const context = cancellationSetup('wallet', { status: 'accepted' });
  await context.cancel();
  assert.equal(context.order.status, 'accepted');
  assert.equal(context.vouchers.length, 0);
  assert.equal(context.transactions.length, 0);
});

test('Điều phối thay thế chờ hết thời gian hiện có dù đã vượt số lượt thử cũ', async () => {
  const now = Date.now();
  const order = { _id: new Types.ObjectId(), status: 'created', readyForMatching: true,
    createdAt: new Date(0), matchingStartedAt: new Date(now),
    matchingSearch: { initialRadiusKm: 5, expandedRadiusKm: 10,
      expandsAt: new Date(now + 180000), expiresAt: new Date(now + 360000) },
    reassignment: { automatic: true, status: 'matching' } };
  const cancellations = [];
  const service = loadService('dispatch.service', {
    mongoose: { Types },
    '../models/order.model': { Order: { findById: () => query(order) } },
    '../models/orderAssignment.model': { OrderAssignment: { exists: async () => false } },
    './systemConfig.service': { getNumberConfigValue: async (_, fallback) => fallback },
    './matching.service': { MatchingService: { findNearestProviders: async () => [] } },
    '../utils/matchingSearch': {
      getMatchingSearchStage: search => ({ expired: search.expiresAt.getTime() <= Date.now(), deadline: search.expiresAt }),
    },
    './orderCancellation.service': { async cancelSystemOrderWithSettlement(...args) { cancellations.push(args); } },
  });
  const tried = Array.from({ length: 10 }, () => new Types.ObjectId());
  const context = { serviceId: new Types.ObjectId().toString(), province: 'Tỉnh kiểm thử', ward: 'Phường kiểm thử' };
  await service.DispatchService.dispatchOrder(order._id.toString(), context, tried);
  assert.equal(cancellations.length, 0);
  order.matchingSearch.expiresAt = new Date(now - 1);
  await service.DispatchService.dispatchOrder(order._id.toString(), context, tried);
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0][2], 'provider_unavailable');
});

test('Voucher bồi thường không hết hạn, giảm đúng 10% và chỉ chủ sở hữu sử dụng được', async () => {
  const ownerId = new Types.ObjectId();
  const voucher = { _id: new Types.ObjectId(), ownerId, code: 'HDTHAYTHE',
    discountType: 'PERCENT', discountValue: 10, minOrderAmount: 0, maxDiscountAmount: null,
    neverExpires: true, isActive: true, status: 'ACTIVE', usedCount: 0, reservedCount: 0, usageLimit: 1,
    applicableOrderType: 'fixed_price', startAt: new Date(0), endAt: new Date(0) };
  const service = loadService('voucher.service', {
    mongoose: { Types },
    './voucherStore.service': { findStoredVoucher: async () => voucher },
  });
  const result = await service.resolveVoucherForAmount(voucher.code, 1000, undefined, ownerId.toString(), false);
  assert.equal(result.discountAmount, 100);
  await assert.rejects(service.resolveVoucherForAmount(voucher.code, 1000, undefined, new Types.ObjectId().toString(), false), /thuộc tài khoản/);
  await assert.rejects(service.resolveVoucherForAmount(voucher.code, 1000, undefined, ownerId.toString(), true), /giá cố định/);
});

test('Thay thợ tái sử dụng đề nghị đã đóng, không tạo trùng cặp đơn và thợ', async () => {
  const assignment = { _id: new Types.ObjectId(), status: 'cancelled' };
  const events = [];
  const service = loadService('dispatch.service', {
    mongoose: { Types },
    '../models/orderAssignment.model': { OrderAssignment: {
      async findOneAndUpdate(filter, update) {
        assert.ok(filter.status.$in.includes(assignment.status));
        setFields(assignment, update.$set); return assignment;
      },
      create() { assert.fail('Không được tạo bản ghi trùng'); },
    } },
    './assignmentRealtime.service': { getAssignmentRealtimePayload: async () => ({}) },
    '../sockets/socketServer': { emitToUser: (_, event) => events.push(event) },
  }, ['sendAssignmentBatch']);
  await service.sendAssignmentBatch(new Types.ObjectId().toString(), [{
    providerId: new Types.ObjectId(), userId: new Types.ObjectId(),
  }], {}, 1, new Date(Date.now() + 90000), true);
  assert.equal(assignment.status, 'pending');
  assert.equal(assignment.respondedAt, null);
  assert.deepEqual(events, ['assignment:new']);
});

test('Timer của đề nghị cũ không được kết thúc sớm đề nghị đã mở lại', async () => {
  const deadline = new Date(Date.now() + 90000);
  const service = loadService('dispatch.service', {
    mongoose: { Types },
    '../models/orderAssignment.model': { OrderAssignment: {
      async findOneAndUpdate(filter) {
        assert.ok(filter.responseDeadline.$lte < deadline);
        return null;
      },
    } },
  });
  await service.DispatchService._onAssignmentTimeout(new Types.ObjectId().toString(), new Types.ObjectId().toString(), new Types.ObjectId(), {});
});

for (const inspectionRequired of [false, true]) {
  for (const status of ['accepted', 'in_progress']) {
    for (const method of ['wallet', 'payos', 'cash']) {
      test(`${status === 'in_progress' ? 'Chặn khách hủy khi đã bắt đầu' : 'Khách được hủy trong 5 phút'}: ${inspectionRequired ? 'báo giá' : 'giá cố định'}, ${method}`, async () => {
        const context = cancellationSetup(method, { customer: true, status, inspectionRequired });
        if (inspectionRequired) context.order.currentQuotationId = new Types.ObjectId();
        if (status === 'in_progress') {
          const preview = await context.service.getCancellationPreview({
            orderId: context.order._id.toString(), actorId: context.order.customerId.toString(), role: 'customer',
          });
          assert.equal(preview.canCancel, false);
          assert.equal(preview.refundAmount, 0);
          await assert.rejects(context.cancel(), /Thợ đã bắt đầu làm việc/);
          assert.equal(context.order.status, 'in_progress');
          assert.equal(context.payment.status, method === 'cash' ? 'pending' : 'paid');
          assert.equal(context.wallet.balance, 20000);
          assert.equal(context.transactions.length, 0);
          assert.equal(context.vouchers.length, 0);
          assert.equal(context.notifications.length, 0);
          return;
        }
        await context.cancel();
        assert.equal(context.order.status, 'cancelled');
        assert.equal(context.order.cancellation.refundPolicy.refundRate, 100);
        assert.equal(context.order.cancellation.refundPolicy.cancellationFee, 0);
        assert.equal(context.wallet.balance, method === 'cash' ? 20000 : 200000);
        assert.equal(context.payment.status, method === 'cash' ? 'failed' : 'refunded');
        assert.equal(context.vouchers.length, 0);
        await context.cancel();
        assert.equal(context.wallet.balance, method === 'cash' ? 20000 : 200000);
      });
    }
  }
}

test('API chặn khách hủy quá 5 phút, không thay đổi đơn, ví hoặc voucher', async () => {
  for (const inspectionRequired of [false, true]) {
    const context = cancellationSetup('payos', { customer: true, status: 'accepted', inspectionRequired,
      acceptedAt: new Date(Date.now() - 301000) });
    await assert.rejects(context.cancel(), /hết thời hạn hủy 5 phút/);
    assert.equal(context.order.status, 'accepted');
    assert.equal(context.payment.status, 'paid');
    assert.equal(context.wallet.balance, 20000);
    assert.equal(context.transactions.length, 0);
    assert.equal(context.vouchers.length, 0);
  }
});

test('Biên đúng 5 phút được hủy; quá 1ms bị chặn cho mọi loại lịch và dịch vụ', () => {
  const { calculateRefundPolicy } = loadService('refundPolicy.service', {});
  const acceptedAt = new Date('2026-10-15T01:00:00Z');
  for (const orderType of ['normal', 'urgent', 'scheduled', 'recurring']) {
    for (const inspectionRequired of [false, true]) {
      for (const elapsed of [0, 299999, 300000, 300001]) {
        const policy = calculateRefundPolicy({ role: 'customer', orderStatus: 'accepted', orderType,
          hasAssignedProvider: true, inspectionRequired, paidAmount: 120000,
          providerAcceptedAt: acceptedAt, now: new Date(acceptedAt.getTime() + elapsed) });
        assert.equal(policy.canCancel, elapsed <= 300000);
        assert.equal(policy.refundAmount, elapsed <= 300000 ? 120000 : 0);
        assert.equal(policy.providerCompensation, 0);
      }
    }
  }
});

test('Lấy mốc nhận gần nhất sau thay thợ, không lấy updatedAt', async () => {
  const context = cancellationSetup('wallet', { customer: true, status: 'accepted' });
  const recent = new Date('2026-10-15T01:05:00Z');
  const deadline = await context.service.getCustomerCancellationDeadline(context.order, undefined, [
    { status: 'accepted', createdAt: new Date('2026-10-15T01:00:00Z') },
    { status: 'created', createdAt: new Date('2026-10-15T01:04:00Z') },
    { status: 'accepted', createdAt: recent },
    { status: 'in_progress', createdAt: new Date('2026-10-15T01:06:00Z') },
  ]);
  assert.equal(deadline.getTime(), recent.getTime() + 300000);
});

test('Đơn đang thực hiện không còn thời hạn hủy cho khách', async () => {
  const context = cancellationSetup('wallet', { customer: true, status: 'in_progress' });
  assert.equal(await context.service.getCustomerCancellationDeadline(context.order), null);
});

test('Chặn hủy sau khi bắt đầu cho mọi loại lịch, kể cả còn trong 5 phút hoặc thiếu provider', () => {
  const { calculateRefundPolicy } = loadService('refundPolicy.service', {});
  const now = new Date('2026-10-15T01:00:00Z');
  for (const orderType of ['normal', 'urgent', 'scheduled', 'recurring']) {
    for (const hasAssignedProvider of [false, true]) {
      const policy = calculateRefundPolicy({ role: 'customer', orderStatus: 'in_progress',
        orderType, hasAssignedProvider, paidAmount: 180000, providerAcceptedAt: now, now });
      assert.equal(policy.canCancel, false);
      assert.equal(policy.refundAmount, 0);
      assert.match(policy.policyReason, /Thợ đã bắt đầu làm việc/);
    }
  }
});

test('Đơn cũ thiếu lịch sử dùng respondedAt; thiếu cả hai mốc thì không mở quyền hủy', async () => {
  const respondedAt = new Date('2026-10-15T01:00:00Z');
  let assignment = { respondedAt };
  const service = loadService('orderCancellation.service', {
    mongoose: { Types },
    '../models/orderStatus.model': { OrderStatus: { findOne: () => query(null) } },
    '../models/orderAssignment.model': { OrderAssignment: { findOne: () => query(assignment) } },
    './refundPolicy.service': loadService('refundPolicy.service', {}),
  });
  const order = { _id: new Types.ObjectId(), providerId: new Types.ObjectId(), status: 'accepted' };
  assert.equal((await service.getCustomerCancellationDeadline(order)).getTime(), respondedAt.getTime() + 300000);
  assignment = null;
  assert.equal(await service.getCustomerCancellationDeadline(order), null);
});

test('Xem trước quá hạn trả canCancel=false, API không tin thời điểm từ khách', async () => {
  const context = cancellationSetup('wallet', { customer: true, status: 'accepted',
    acceptedAt: new Date(Date.now() - 301000) });
  const preview = await context.service.getCancellationPreview({
    orderId: context.order._id.toString(), actorId: context.order.customerId.toString(), role: 'customer',
  });
  assert.equal(preview.canCancel, false);
  assert.equal(preview.refundAmount, 0);
  assert.equal(context.order.status, 'accepted');
});

test('QR nhận tiền muộn sau khi khách hủy vẫn hoàn về ví, không payout hoặc hoàn trùng', async () => {
  const context = cancellationSetup('payos', { customer: true, status: 'accepted' });
  context.payment.status = 'pending';
  await context.cancel();
  assert.equal(context.wallet.balance, 20000);
  context.payment.status = 'paid';
  await context.service.settleCancelledOrderPayments(context.order._id, 'Khách hủy trong thời hạn');
  assert.equal(context.wallet.balance, 200000);
  assert.equal(context.payment.status, 'refunded');
  await context.service.settleCancelledOrderPayments(context.order._id, 'Khách hủy trong thời hạn');
  assert.equal(context.wallet.balance, 200000);
});
