const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { Order } = require('../models/order.model');
const { Provider } = require('../models/provider.model');
const { RepairQuotation } = require('../models/repairQuotation.model');
const { Payment } = require('../models/payment.model');
const { Wallet } = require('../models/wallet.model');
const { WalletTransaction } = require('../models/walletTransaction.model');
const { withTransactionRetry, buildTransactionCode } = require('../utils/transaction');
const { AppError } = require('../utils/appError');
const { EJSON } = mongoose.mongo.BSON;
const copy = value => EJSON.parse(EJSON.stringify(value, { relaxed: false }));
const id = () => new mongoose.Types.ObjectId();
const customer = id(), providerId = id(), providerUser = id(), orderId = id(), quotationId = id();
let state, version, failCredit, failLedger, failRewards, failNotification, directRace, notifications;
const constructors = { orders: Order, providers: Provider, quotations: RepairQuotation, payments: Payment,
  wallets: Wallet, ledgers: WalletTransaction };
const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
const matches = (row, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some(condition => matches(row, condition));
  const actual = get(row, key);
  if (expected && '$in' in Object(expected)) return expected.$in.some(value => String(actual) === String(value));
  if (expected && '$gte' in Object(expected)) return actual >= expected.$gte;
  if (expected && '$ne' in Object(expected)) return String(actual) !== String(expected.$ne);
  return expected == null ? actual == null : String(actual) === String(expected);
});
const view = session => session?.snapshot ?? state;
const document = (collection, row) => {
  if (!row) return null;
  const result = constructors[collection]?.hydrate(copy(row)) ?? copy(row);
  result.save = async (options = {}) => {
    const rows = view(options.session)[collection];
    const index = rows.findIndex(value => String(value._id) === String(result._id));
    rows[index] = copy(result.toObject ? result.toObject() : result);
    return result;
  };
  return result;
};
const query = work => ({ session(session) { this.context = session; return this; }, select() { return this; }, sort() { return this; },
  then(resolve, reject) { return Promise.resolve().then(() => work(this.context)).then(resolve, reject); } });
function update(collection, filter, change, options) {
  assert.ok(options.session, 'Ghi tài chính phải nằm trong giao dịch.');
  assert.equal(options.runValidators, true);
  if (collection === 'wallets' && change.$inc?.balance > 0 && failCredit) throw new Error('Lỗi cộng ví thợ giả lập');
  const rows = view(options.session)[collection];
  let row = rows.find(value => matches(value, filter));
  if (!row && options.upsert) {
    row = { _id: id(), userId: filter.userId, balance: 0, isDeleted: false, ...copy(change.$setOnInsert ?? {}) };
    rows.push(row);
  }
  if (!row) return null;
  Object.assign(row, copy(change.$set ?? {}));
  for (const [key, amount] of Object.entries(change.$inc ?? {})) row[key] = (row[key] ?? 0) + amount;
  return row;
}
function model(collection) {
  return {
    findOne: filter => query(session => document(collection, view(session)[collection].find(row => matches(row, filter)))),
    findById: value => query(session => document(collection, view(session)[collection].find(row => String(row._id) === String(value)))),
    find: filter => query(session => view(session)[collection].filter(row => matches(row, filter)).map(row => document(collection, row))),
    exists: filter => query(session => view(session)[collection].some(row => matches(row, filter)) ? { _id: orderId } : null),
    findOneAndUpdate: (filter, change, options) => query(() => document(collection, update(collection, filter, change, options))),
    updateOne: (filter, change, options = {}) => query(() => {
      const row = update(collection, filter, change, options.session ? options : { ...options, session: {} });
      return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
    }),
    create: async (rows, options) => {
      assert.ok(options.session);
      if (collection === 'ledgers' && failLedger) throw new Error('Lỗi ghi sổ ví giả lập');
      const created = [];
      const documents = rows.map(value => {
        const row = constructors[collection] ? new constructors[collection]({ ...value, createdAt: new Date() })
          : { ...value, _id: value._id ?? id(), isDeleted: false };
        row.$save = async () => {
          if (row.validate) await row.validate();
          const stored = row.toObject ? row.toObject() : { ...value, _id: row._id, isDeleted: false };
          view(options.session)[collection].push(copy(stored)); created.push(document(collection, stored));
          return row;
        };
        return row;
      });
      // Dùng Model.create thật để giữ ràng buộc session/ordered của Mongoose; chỉ giả lập thao tác lưu.
      if (constructors[collection]) {
        await constructors[collection].create(documents, options);
      } else {
        for (const row of documents) await row.$save();
      }
      return created;
    },
  };
}
const connection = { startSession: async () => ({
  async withTransaction(work) {
    const initialVersion = version; this.snapshot = copy(state);
    const result = await work(this);
    if (initialVersion !== version) throw Object.assign(new Error('Xung đột ghi giả lập'), { code: 112 });
    state = this.snapshot; version++; return result;
  }, endSession: async () => {},
}) };
const modules = {
  mongoose: { __esModule: true, default: connection, Types: mongoose.Types },
  '../utils/appError': { AppError }, '../utils/transaction': { withTransactionRetry, buildTransactionCode },
    '../utils/logger': { createLogger: () => ({ warn() {}, error() {} }) },
  '../sockets/socketServer': { emitToUser() {} },
  './notification.service': { createNotificationRecord: async () => {
    if (failNotification) throw new Error('Lỗi thông báo giả lập'); notifications++;
  } },
  './providerSchedule.service': { lockProviderSchedule: async (provider, session) => {
    const locked = await model('providers').findOneAndUpdate({ _id: provider, verified: true, isDeleted: false },
      { $inc: { scheduleVersion: 1 } }, { session, runValidators: true });
    if (!locked) throw new AppError('Thợ chưa được duyệt.', 409);
    if (directRace) {
      directRace = false; state.orders[0].paymentStatus = 'paid';
      state.quotations[0].directPaymentConfirmedAt = new Date(); state.quotations[0].directPaymentConfirmedAmount = 180000; version++;
    }
    return locked;
  } },
  './voucherStore.service': {}, '../configs/rewards': { REWARD_POLICY: {}, calculateRewardPoints: amount => Math.floor(amount / 10000) },
  './systemConfig.service': { getRewardPolicy: async () => { if (failRewards) throw new Error('Lỗi tích điểm giả lập'); return { amountPerPoint: 10000 }; } },
  './penaltyPolicy.service': {}, '../validations/reward.validator': {},
};
for (const [name, collection] of [['Order', 'orders'], ['Provider', 'providers'], ['RepairQuotation', 'quotations'],
  ['Payment', 'payments'], ['Wallet', 'wallets'], ['WalletTransaction', 'ledgers']]) {
  const filename = name[0].toLowerCase() + name.slice(1);
  modules[`../models/${filename}.model`] = { [name]: model(collection) };
}
modules['../models/voucher.model'] = {};
modules['../models/reward.model'] = { RewardAccount: model('rewardAccounts'), RewardTransaction: model('rewards') };
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, Number, process: { env: {} }, require: name => {
    if (name in modules) return modules[name];
    if (name === 'crypto') return require(name);
    throw new Error(`Chưa giả lập module: ${name}`);
  } });
  return exports;
}
modules['./reward.service'] = load('../services/reward.service');
const quotationService = load('../services/quotationWalletPayment.service');
const { payQuotationByWallet } = quotationService;
const links = new Map();
let gatewaySequence = 0, cancellationMode = 'cancel';
modules['./quotationWalletPayment.service'] = quotationService;
modules['../configs/payos.config'] = { payos: {
  webhooks: { verify: async payload => payload.data },
  paymentRequests: {
    create: async data => {
      const link = { ...data, id: `lien-ket-${++gatewaySequence}`, paymentLinkId: `lien-ket-${gatewaySequence}`,
        amountPaid: 0, status: 'PENDING', checkoutUrl: `https://pay.test/${gatewaySequence}`, qrCode: 'du-lieu-qr' };
      links.set(data.orderCode, link); return link;
    },
    get: async code => links.get(code),
    cancel: async code => {
      const link = links.get(code);
      if (cancellationMode === 'unknown') return;
      link.status = cancellationMode === 'paid' ? 'PAID' : 'CANCELLED';
      if (link.status === 'PAID') { link.amountPaid = link.amount; link.transactions = [{ reference: `tham-chieu-${code}` }]; }
    },
  },
} };
modules['../models/promotion.model'] = {};
modules['../models/service.model'] = {};
modules['../models/refund.model'] = { Refund: model('refunds') };
modules['./wallet.service'] = {};
modules['./voucher.service'] = { markOrderVoucherAsUsed: async () => {} };
modules['../utils/actionPreconditionError'] = require('../utils/actionPreconditionError');
modules['./paymentStatus.service'] = { publishPaymentStatus() {} };
modules['../utils/paymentRedirect'] = {
  resolvePaymentFrontendOrigin: () => 'https://handigo.test',
  buildOrderPaymentRedirects: () => ({ returnUrl: 'https://handigo.test/result', cancelUrl: 'https://handigo.test/cancel' }),
};
modules['./notification.service'].emitRealtimeNotification = () => {};
const paymentService = load('../services/payment.service');
const user = { id: String(customer), role: 'CUSTOMER' };
const input = { orderId: String(orderId), method: 'WALLET', paymentType: 'REMAINING', expectedAmount: 180000,
  quotationId: String(quotationId), expectedRevision: 2 };
function reset() {
  version = 0; failCredit = false; failLedger = false; failRewards = false; failNotification = false; directRace = false; notifications = 0;
  state = {
    orders: [{ _id: orderId, customerId: customer, providerId, currentQuotationId: quotationId, inspectionRequired: true,
      depositPaidAt: new Date(), depositAmount: 20000, status: 'completed', paymentStatus: 'partially_paid', paymentMethod: 'bank',
      pricing: { baseAmount: 20000, totalPaidAmount: 20000, providerEarningAmount: 20000 }, isDeleted: false }],
    providers: [{ _id: providerId, userId: providerUser, verified: true, isDeleted: false }],
    quotations: [{ _id: quotationId, orderId, customerId: customer, providerId, revision: 2, status: 'saved', finalAmount: 200000,
      directPaymentConfirmedAt: null, isDeleted: false }],
    wallets: [{ _id: id(), userId: customer, balance: 500000, pendingBalance: 0, isDeleted: false },
      { _id: id(), userId: providerUser, balance: 100000, pendingBalance: 9000, isDeleted: false }],
    payments: [], ledgers: [], rewards: [], rewardAccounts: [], refunds: [],
  };
}
async function rejectedWithoutChanges(work, pattern) {
  const before = copy(state); await assert.rejects(work, pattern); assert.deepEqual(state, before);
}
(async () => {
  reset();
  const result = await payQuotationByWallet(user, input);
  assert.equal(result.amount, 180000); assert.equal(result.payment.paymentType, 'remaining');
  assert.equal(state.wallets[0].balance, 320000); assert.equal(state.wallets[1].balance, 280000);
  assert.equal(state.wallets[1].pendingBalance, 9000, 'Tiền vào số dư khả dụng, không vào số dư chờ.');
  assert.equal(state.orders[0].paymentStatus, 'paid'); assert.equal(state.orders[0].paymentMethod, 'wallet');
  assert.equal(state.orders[0].pricing.totalPaidAmount, 20000, 'Giữ nguyên cơ sở khấu trừ cọc.');
  assert.equal(state.ledgers.length, 2); assert.ok(state.ledgers.every(row => row.amount === 180000 && row.metadata.platformCommissionAmount === 0));
  assert.equal(state.quotations[0].directPaymentConfirmedAt, null);
  assert.equal(state.rewards[0].points, 20, 'Tích điểm theo tổng báo giá, không cộng cọc lần nữa.');
  await payQuotationByWallet(user, input);
  assert.equal(state.payments.length, 1); assert.equal(state.ledgers.length, 2); assert.equal(state.rewards.length, 1); assert.equal(notifications, 2);
  reset(); await Promise.all([payQuotationByWallet(user, input), payQuotationByWallet(user, input)]);
  assert.equal(state.wallets[0].balance, 320000); assert.equal(state.wallets[1].balance, 280000); assert.equal(state.ledgers.length, 2);
  reset(); state.wallets[0].balance = 100;
  await rejectedWithoutChanges(() => payQuotationByWallet(user, input), /không đủ/);
  for (const kind of ['credit', 'ledger', 'rewards']) {
    reset(); failCredit = kind === 'credit'; failLedger = kind === 'ledger'; failRewards = kind === 'rewards';
    await rejectedWithoutChanges(() => payQuotationByWallet(user, input), /giả lập/);
  }
  const cases = [
    () => { state.orders[0].status = 'in_progress'; },
    () => { state.orders[0].status = 'cancelled'; },
    () => { state.orders[0].paymentStatus = 'refunded'; },
    () => { state.orders[0].depositPaidAt = null; },
    () => { state.quotations[0].status = 'pending'; },
    () => { state.quotations[0].revision++; },
    () => { state.orders[0].currentQuotationId = id(); },
    () => { state.quotations[0].directPaymentConfirmedAt = new Date(); },
    () => { state.orders[0].inspectionRequired = false; },
    () => { state.providers[0].verified = false; },
  ];
  for (const change of cases) { reset(); change(); await rejectedWithoutChanges(() => payQuotationByWallet(user, input)); }
  reset(); await rejectedWithoutChanges(() => payQuotationByWallet({ ...user, id: String(id()) }, input), /đơn hàng của bạn/);
  await rejectedWithoutChanges(() => payQuotationByWallet({ ...user, role: 'PROVIDER' }, input), /Chỉ khách hàng/);
  for (const patch of [{ method: 'PAYOS' }, { method: 'CASH' }, { expectedAmount: 170000 }, { expectedRevision: undefined }, { quotationId: undefined }]) {
    await rejectedWithoutChanges(() => payQuotationByWallet(user, { ...input, ...patch }));
  }
  reset(); state.wallets.pop(); await payQuotationByWallet(user, input);
  assert.equal(state.wallets[1].balance, 180000, 'Tạo ví thợ khi chưa có.');
  reset(); state.orders[0].pricing.totalPaidAmount = 0;
  await payQuotationByWallet(user, { ...input, expectedAmount: 200000 });
  assert.equal(state.wallets[0].balance, 300000, 'Cọc được miễn không được khấu trừ như tiền khách đã trả.');
  reset(); delete state.orders[0].pricing.baseAmount; state.orders[0].pricing.totalPaidAmount = 0;
  await payQuotationByWallet(user, input); assert.equal(state.wallets[0].balance, 320000, 'Đơn cũ khấu trừ theo tiền cọc đã trả.');
  reset(); failNotification = true; await payQuotationByWallet(user, input); assert.equal(state.orders[0].paymentStatus, 'paid');
  reset(); directRace = true;
  await assert.rejects(payQuotationByWallet(user, input), /đã được thanh toán/);
  assert.equal(state.wallets[0].balance, 500000); assert.equal(state.wallets[1].balance, 100000); assert.equal(state.ledgers.length, 0);
  // Tạo QR chưa thanh toán; webhook xác minh mới cộng ví thợ đúng một lần.
  reset();
  const payosInput = { ...input, method: 'PAYOS' };
  const qr = await paymentService.createOrderPayment(user, payosInput);
  assert.equal(qr.payment.paymentType, 'remaining'); assert.equal(qr.payment.amount, 180000);
  assert.equal(state.orders[0].paymentStatus, 'partially_paid'); assert.equal(state.wallets[1].balance, 100000);
  const reused = await paymentService.createOrderPayment(user, payosInput);
  assert.equal(String(reused.payment._id), String(qr.payment._id)); assert.equal(state.payments.length, 1);
  const webhook = { success: true, data: { orderCode: Number(qr.payment.gatewayOrderCode), amount: 180000,
    paymentLinkId: qr.payment.gatewayPaymentLinkId, reference: 'tham-chieu-webhook', code: '00' } };
  await assert.rejects(paymentService.handlePayosWebhook({ ...webhook, data: { ...webhook.data, amount: 170000 } }), /không khớp/);
  assert.equal(state.wallets[1].balance, 100000);
  failLedger = true;
  await rejectedWithoutChanges(() => paymentService.handlePayosWebhook(webhook), /giả lập/);
  failLedger = false;
  await paymentService.handlePayosWebhook(webhook);
  await paymentService.handlePayosWebhook(webhook);
  assert.equal(state.wallets[0].balance, 500000); assert.equal(state.wallets[1].balance, 280000);
  assert.equal(state.ledgers.length, 1); assert.equal(state.orders[0].paymentStatus, 'paid');
  assert.equal(state.orders[0].paymentMethod, 'bank'); assert.equal(state.rewards[0].points, 20);

  // Đổi PayOS sang ví: chỉ hủy QR sau khi biết ví đủ và xác minh cổng đã hủy.
  reset(); cancellationMode = 'cancel';
  const oldQr = await paymentService.createOrderPayment(user, payosInput);
  state.wallets[0].balance = 100;
  await assert.rejects(paymentService.createOrderPayment(user, input), /không đủ/);
  assert.equal(links.get(Number(oldQr.payment.gatewayOrderCode)).status, 'PENDING');
  state.wallets[0].balance = 500000; cancellationMode = 'unknown';
  await assert.rejects(paymentService.createOrderPayment(user, input), /Chưa xác minh/);
  assert.equal(state.wallets[0].balance, 500000);
  cancellationMode = 'cancel'; await paymentService.createOrderPayment(user, input);
  assert.equal(state.payments.filter(row => row.status === 'paid').length, 1);
  assert.equal(state.wallets[0].balance, 320000); assert.equal(state.wallets[1].balance, 280000);
  // QR cũ đến muộn được hoàn ví khách, không cộng ví thợ lần hai.
  await paymentService.handlePayosWebhook({ success: true, data: { orderCode: Number(oldQr.payment.gatewayOrderCode), amount: 180000,
    paymentLinkId: oldQr.payment.gatewayPaymentLinkId, reference: 'qr-cu-den-muon', code: '00' } });
  assert.equal(state.wallets[0].balance, 500000); assert.equal(state.wallets[1].balance, 280000);
  assert.equal(state.refunds.length, 1);

  reset();
  const staleQr = await paymentService.createOrderPayment(user, payosInput);
  state.payments[0].status = 'failed'; state.quotations[0].revision++;
  await paymentService.handlePayosWebhook({ success: true, data: { orderCode: Number(staleQr.payment.gatewayOrderCode), amount: 180000,
    paymentLinkId: staleQr.payment.gatewayPaymentLinkId, reference: 'bao-gia-cu-den-muon', code: '00' } });
  assert.equal(state.wallets[0].balance, 680000); assert.equal(state.wallets[1].balance, 100000);
  assert.equal(state.payments[0].status, 'refunded'); assert.equal(state.orders[0].paymentStatus, 'partially_paid');

  // Cổng vừa nhận tiền khi đổi phương thức: đối soát rồi trả kết quả, không trừ ví khách.
  reset(); cancellationMode = 'paid';
  await paymentService.createOrderPayment(user, payosInput);
  const paid = await paymentService.createOrderPayment(user, input);
  assert.equal(paid.payment.method, 'payos'); assert.equal(paid.payment.status, 'paid');
  assert.equal(state.wallets[0].balance, 500000); assert.equal(state.wallets[1].balance, 280000);
  console.log('Đạt: thanh toán báo giá bằng ví/PayOS, đổi QR sang ví, đối soát khi vừa nhận tiền, webhook lặp/sai tiền, hoàn QR cũ, cộng ví thợ không phí, hoàn tác và cạnh tranh với thu trực tiếp.');
})().catch(error => { console.error(error); process.exitCode = 1; });
