const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { AppError } = require('../utils/appError');
const { withTransactionRetry } = require('../utils/transaction');

// Mô phỏng snapshot, commit nguyên tử và xung đột ghi; không gọi database/PayOS thật.
let state, link, revision, calls, failSave, missingWallet, onCancel, failGet, conflicts;
const user = { id: 'khach-hang', role: 'CUSTOMER' };
const code = '1234562';
const clone = value => structuredClone(value);
const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
  value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value);
function reset(status = 'pending', gatewayStatus = 'PENDING', amountPaid = 0) {
  state = { balance: 50000, transaction: { _id: 'giao-dich', userId: user.id, walletId: 'vi',
    type: 'deposit', direction: 'in', amount: 100000, status, isDeleted: false,
    gatewayOrderCode: code, gatewayPaymentLinkId: 'lien-ket', gatewayResponse: {} } };
  link = { id: 'lien-ket', orderCode: Number(code), amount: 100000, status: gatewayStatus,
    amountPaid, transactions: amountPaid ? [{ reference: 'tham-chieu' }] : [] };
  revision = 0; calls = { get: 0, cancel: 0, ended: 0, credit: 0 };
  failSave = false; missingWallet = false; onCancel = null; failGet = false; conflicts = 0;
}
const transactions = {
  findOne: async filter => matches(state.transaction, filter) ? clone(state.transaction) : null,
  findById: id => ({ session: async session => {
    if (session.snapshot.transaction._id !== id) return null;
    const doc = clone(session.snapshot.transaction);
    doc.save = async options => {
      assert.equal(options.session, session);
      if (failSave) throw new Error('Lỗi lưu giao dịch giả lập');
      const { save, ...data } = doc;
      session.snapshot.transaction = clone(data);
    };
    return doc;
  } }),
  findOneAndUpdate: async (filter, update, options) => {
    assert.equal(options.runValidators, true);
    if (!matches(state.transaction, filter)) return null;
    Object.assign(state.transaction, clone(update.$set)); revision++;
    return clone(state.transaction);
  },
};
const wallets = { findOneAndUpdate: async (filter, update, options) => {
  assert.equal(filter._id, 'vi');
  assert.equal(options.runValidators, true);
  if (missingWallet) return null;
  options.session.snapshot.balance += update.$inc.balance;
  options.session.credit++;
  return { balance: options.session.snapshot.balance };
} };
const mongoose = { startSession: async () => ({
  async withTransaction(operation) {
    const start = revision; this.snapshot = clone(state); this.credit = 0;
    await operation(this);
    if (start !== revision) {
      conflicts++;
      throw Object.assign(new Error('Xung đột ghi giả lập'), { code: 112 });
    }
    state = this.snapshot; calls.credit += this.credit; revision++;
  },
  async endSession() { calls.ended++; },
}) };
const payos = { paymentRequests: {
  async get(orderCode) {
    assert.equal(orderCode, Number(code)); calls.get++;
    if (failGet) throw new Error('PayOS giả lập không phản hồi');
    return clone(link);
  },
  async cancel(orderCode) {
    assert.equal(orderCode, Number(code)); calls.cancel++;
    if (onCancel) return onCancel();
    link.status = 'CANCELLED'; return clone(link);
  },
} };
function load(file, resolve, extras = {}) {
  const context = { exports: {}, require: resolve, Date, Number, URL, ...extras };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const wallet = load('../services/wallet.service', name => {
  if (name === 'mongoose') return { ...mongoose, default: mongoose, __esModule: true };
  if (name === '../configs/payos.config') return { payos };
  if (name === '../models/walletTransaction.model') return { WalletTransaction: transactions };
  if (name === '../models/wallet.model') return { Wallet: wallets };
  if (name === '../models/user.model') return { default: { findById: () => ({ select: () => ({ session: async () => ({ status: 'active' }) }) }) }, __esModule: true };
  if (name === '../utils/transaction') return { withTransactionRetry };
  if (name === '../utils/appError') return { AppError };
  return {};
});
const webhook = patch => wallet.handleWalletDepositPayosWebhook({ orderCode: Number(code),
  amount: 100000, paymentLinkId: 'lien-ket', reference: 'tham-chieu', code: '00', ...patch }, { daXacMinh: true });
const paid = () => { link.status = 'PAID'; link.amountPaid = 100000; link.transactions = [{ reference: 'tham-chieu' }]; };
const creditedOnce = () => {
  assert.equal(state.transaction.status, 'success');
  assert.equal(state.balance, 150000); assert.equal(calls.credit, 1);
  assert.equal(state.transaction.balanceAfter, 150000);
};
const rejects = (operation, status) => assert.rejects(operation, error => error.statusCode === status);

async function testReturnHook() {
  for (const result of ['success', 'cancelled', 'pending']) {
    let effect, notice = '', removed = false, refreshed = false;
    const storage = { getItem: () => null, removeItem: () => { removed = true; } };
    const { useWalletDepositReturn } = load('../../../handigo-web/src/features/wallet/components/useWalletDepositReturn.ts', name => {
      if (name === 'react') return { useRef: value => ({ current: value }), useEffect: callback => { effect = callback; } };
      if (name === '../api/wallet.api') return { walletApi: { cancelDeposit: async () => ({ status: result }) } };
      if (name === './wallet-formatters') return { getErrorMessage: error => error.message };
      return {};
    }, { URLSearchParams, sessionStorage: storage, window: {
      location: { search: `?walletDeposit=cancelled&orderCode=${code}`, pathname: '/customer/wallet' },
      history: { replaceState() {} },
    } });
    useWalletDepositReturn({ refreshAll: async () => { refreshed = true; },
      setNotice: value => { notice = value; }, setError: value => { assert.equal(value, ''); } });
    effect(); await new Promise(setImmediate);
    assert.match(notice, result === 'success' ? /Nạp ví thành công/ : result === 'cancelled' ? /Đã hủy/ : /chưa được PayOS xác nhận/);
    assert.ok(removed && refreshed);
  }
}
async function run() {
  reset(); await wallet.cancelWalletDeposit(user, code);
  assert.equal(state.transaction.status, 'cancelled'); assert.equal(state.balance, 50000);
  assert.equal(calls.get, 2); assert.equal(calls.cancel, 1);
  assert.equal(state.transaction.gatewayResponse.cancelledBy, 'customer');
  await webhook(); await webhook(); await wallet.syncWalletDeposit(user, code); creditedOnce();

  for (const status of ['pending', 'failed', 'cancelled']) {
    reset(status); paid(); await wallet.syncWalletDeposit(user, code); creditedOnce();
    await wallet.cancelWalletDeposit(user, code); await webhook(); creditedOnce();
    assert.equal(calls.cancel, 0);
  }
  reset('cancelled', 'CANCELLED', 100000);
  await wallet.syncWalletDeposit(user, code); creditedOnce();
  reset(); paid(); await wallet.cancelWalletDeposit(user, code); creditedOnce();
  reset(); onCancel = async () => { paid(); throw new Error('PayOS vừa nhận tiền'); };
  await wallet.cancelWalletDeposit(user, code); creditedOnce();
  // Webhook thành công chạy trong lúc hủy: cập nhật hủy không được ghi đè success.
  reset(); onCancel = async () => { await webhook(); link.status = 'CANCELLED'; };
  const cancelled = await wallet.cancelWalletDeposit(user, code);
  assert.equal(cancelled.status, 'success'); creditedOnce();

  reset(); onCancel = async () => { throw new Error('Hủy không thành công'); };
  await rejects(wallet.cancelWalletDeposit(user, code), 409);
  assert.equal(state.transaction.status, 'pending'); assert.equal(calls.credit, 0);
  reset(); failGet = true; await rejects(wallet.cancelWalletDeposit(user, code), 502);
  assert.equal(state.transaction.status, 'pending'); assert.equal(calls.cancel, 0);
  reset(); onCancel = async () => { link.status = 'CANCELLED'; throw new Error('Mất phản hồi sau hủy'); };
  await wallet.cancelWalletDeposit(user, code);
  assert.equal(state.transaction.status, 'cancelled'); assert.equal(calls.credit, 0);
  reset(); onCancel = async () => { link.status = 'CANCELLED'; failGet = true; };
  await rejects(wallet.cancelWalletDeposit(user, code), 502);
  assert.equal(state.transaction.status, 'pending'); assert.equal(calls.credit, 0);
  for (const patch of [{ orderCode: 999 }, { amount: 1 }, { id: 'sai-lien-ket' }, { amountPaid: NaN }]) {
    reset(); Object.assign(link, patch);
    await rejects(wallet.cancelWalletDeposit(user, code), 409);
    await rejects(wallet.syncWalletDeposit(user, code), 409);
    assert.equal(calls.credit, 0); assert.equal(calls.cancel, 0);
  }
  for (const [status, amount] of [['PROCESSING', 0], ['UNDERPAID', 50000], ['CANCELLED', 50000], ['PAID', 50000]]) {
    reset('pending', status, amount);
    await rejects(wallet.cancelWalletDeposit(user, code), 409);
    assert.equal(state.transaction.status, 'pending'); assert.equal(calls.cancel, 0);
  }
  reset();
  await rejects(wallet.cancelWalletDeposit({ ...user, id: 'khach-khac' }, code), 404);
  await rejects(wallet.syncWalletDeposit({ ...user, id: 'khach-khac' }, code), 404);
  assert.equal(calls.get, 0);
  for (const patch of [{ amount: 1 }, { paymentLinkId: 'sai' }, { reference: '' }]) {
    reset('cancelled'); await assert.rejects(webhook(patch));
    assert.equal(state.balance, 50000); assert.equal(state.transaction.status, 'cancelled');
  }
  reset('cancelled'); await webhook({ code: '01' });
  assert.equal(state.transaction.status, 'cancelled'); assert.equal(calls.credit, 0);

  reset('cancelled'); paid();
  await Promise.all([webhook(), webhook(), wallet.syncWalletDeposit(user, code), wallet.cancelWalletDeposit(user, code)]);
  creditedOnce(); assert.ok(conflicts > 0, 'Phải thực sự kiểm tra nhánh thử lại xung đột ghi.');
  assert.equal(calls.ended, 4);
  await webhook({ code: '01' }); creditedOnce();
  reset('cancelled'); failSave = true;
  await assert.rejects(webhook()); assert.equal(state.balance, 50000);
  assert.equal(state.transaction.status, 'cancelled'); assert.equal(calls.ended, 1);
  failSave = false; await webhook(); creditedOnce();
  reset('cancelled'); missingWallet = true;
  await rejects(webhook(), 404); assert.equal(state.balance, 50000);
  assert.equal(state.transaction.status, 'cancelled');
  // Điểm vào webhook thật phải xác minh trước khi chuyển dữ liệu cho dịch vụ ví.
  let verified = false, forwarded = 0;
  payos.webhooks = { verify: async () => {
    if (!verified) throw new Error('Chữ ký giả lập không hợp lệ');
    return { orderCode: Number(code), amount: 100000, paymentLinkId: 'lien-ket', reference: 'tham-chieu', code: '00' };
  } };
  const payment = load('../services/payment.service', name => {
    if (name === '../configs/payos.config') return { payos };
    if (name === '../models/payment.model') return { Payment: { findOne: () => ({ select: async () => null }) } };
    if (name === '../utils/logger') return { createLogger: () => ({}) };
    if (name === '../utils/appError') return { AppError };
    if (name === './wallet.service') return { handleWalletDepositPayosWebhook: (...args) => {
      forwarded++; return wallet.handleWalletDepositPayosWebhook(...args);
    } };
    return {};
  });
  reset('cancelled');
  await assert.rejects(payment.handlePayosWebhook({ amount: 1 }));
  assert.equal(forwarded, 0); assert.equal(calls.credit, 0);
  verified = true;
  await payment.handlePayosWebhook({ amount: 1 }); creditedOnce();
  assert.equal(forwarded, 1);
  await testReturnHook();
  console.log('Đạt: hủy PayOS có đối soát, tiền đến muộn, webhook lặp/đồng thời, rollback, ownership và thông báo web đúng trạng thái.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
