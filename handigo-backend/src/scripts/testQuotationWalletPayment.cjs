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
  return expected == null ? actual == null : String(actual) === String(expected);
});
const view = session => session?.snapshot ?? state;
const document = (collection, row) => row ? constructors[collection]?.hydrate(copy(row)) ?? copy(row) : null;
const query = work => ({ session(session) { this.context = session; return this; }, select() { return this; },
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
    exists: filter => query(session => view(session)[collection].some(row => matches(row, filter)) ? { _id: orderId } : null),
    findOneAndUpdate: (filter, change, options) => query(() => document(collection, update(collection, filter, change, options))),
    updateOne: (filter, change, options) => query(() => ({ matchedCount: update(collection, filter, change, options) ? 1 : 0 })),
    create: async (rows, options) => {
      assert.ok(options.session);
      if (collection === 'ledgers' && failLedger) throw new Error('Lỗi ghi sổ ví giả lập');
      const created = [];
      for (const value of rows) {
        const row = constructors[collection] ? new constructors[collection]({ ...value, createdAt: new Date() })
          : { ...value, _id: value._id ?? id(), isDeleted: false };
        if (row.validate) await row.validate();
        const stored = row.toObject ? row.toObject() : row;
        view(options.session)[collection].push(copy(stored)); created.push(document(collection, stored));
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
  '../utils/logger': { createLogger: () => ({ warn() {} }) },
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
  }).outputText, { exports, Date, Number, require: name => {
    if (name in modules) return modules[name];
    if (name === 'crypto') return require(name);
    throw new Error(`Chưa giả lập module: ${name}`);
  } });
  return exports;
}
modules['./reward.service'] = load('../services/reward.service');
const { payQuotationByWallet } = load('../services/quotationWalletPayment.service');
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
    payments: [], ledgers: [], rewards: [], rewardAccounts: [],
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
  console.log('Đạt: trừ/cộng ví nguyên tử, không phí nền tảng, chống trùng, cọc mới/cũ, tích điểm, phân quyền, trạng thái, báo giá cũ, hoàn tác và cạnh tranh với thu trực tiếp.');
})().catch(error => { console.error(error); process.exitCode = 1; });
