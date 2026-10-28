const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user.model').default;
const { SupportTicket } = require('../models/supportTicket.model');
const { AppError } = require('../utils/appError');
const otp = require('../utils/otp');

// Chạy service và document Mongoose thật, cô lập database, OAuth và gửi thư.
function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, console, setTimeout, clearTimeout, ...globals,
    require: name => name in modules ? modules[name] : require(name) });
  return exports;
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(item => matches(row, item));
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
      if ('$exists' in value) return (actual !== undefined) === value.$exists;
      if ('$gt' in value) return actual > value.$gt;
    }
    return value == null ? actual == null : String(actual) === String(value);
  });
}
function apply(row, update) {
  Object.assign(row, update.$set ?? {});
  for (const key of Object.keys(update.$unset ?? {})) delete row[key];
  for (const [key, value] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + value;
  for (const [key, value] of Object.entries(update.$push ?? {})) row[key].push(...(value.$each ?? [value]));
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function authCases() {
  let stored;
  let holdHash;
  let hashStarted;
  let beforeUpdate;
  const users = {
    findOne: async filter => matches(stored, filter) ? User.hydrate(stored) : null,
    exists: async () => null,
    findOneAndUpdate: async (filter, update, options) => {
      assert.equal(options.runValidators, true);
      if (beforeUpdate) { const action = beforeUpdate; beforeUpdate = null; await action(); }
      if (!matches(stored, filter)) return null;
      apply(stored, update);
      return User.hydrate(stored);
    },
  };
  const auth = load('../services/auth.service', {
    '../models/user.model': { __esModule: true, default: users },
    '../models/session.model': { Session: { updateOne: async () => ({}) } },
    '../models/wallet.model': { Wallet: { updateOne: async () => ({}) } },
    '../utils/otp': otp, '../utils/appError': { AppError },
    '../utils/profileValidation': require('../utils/profileValidation'),
    '../utils/mail': { sendOtpEmail: async () => {} },
    '../services/providerPresence.service': {},
    './providerPresence.service': { markProviderOffline: async () => {} },
    '../sockets/socketServer': {},
    '../utils/token': { signAccessToken: () => 'ma-kiem-thu', signRefreshToken: () => 'ma-lam-moi' },
    jsonwebtoken: { decode: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }) },
    bcrypt: { ...bcrypt, hash: async (...args) => {
      if (holdHash) { hashStarted.resolve(); await holdHash.promise; }
      return bcrypt.hash(...args);
    } },
    'google-auth-library': { OAuth2Client: class {
      async verifyIdToken() { return { getPayload: () => ({ sub: 'google-kiem-thu', email: stored.email, email_verified: true }) }; }
    } },
    axios: { get: async url => url.includes('debug_token')
      ? { data: { data: { app_id: 'facebook-kiem-thu', is_valid: true, user_id: 'facebook-user' } } }
      : { data: { email: stored.email, name: 'Khách Hàng' } } },
  }, { process: { env: { GOOGLE_CLIENT_ID: 'google-kiem-thu', FACEBOOK_APP_ID: 'facebook-kiem-thu', FACEBOOK_APP_SECRET: 'du-lieu-gia' } } });
  const oldPassword = 'MatKhauCu123!';
  const passwordHash = await bcrypt.hash(oldPassword, 4);
  function reset(verified = false) {
    stored = { _id: new mongoose.Types.ObjectId(), email: 'khach@example.test', fullName: 'Khách Hàng',
      passwordHash, isEmailVerified: verified, status: 'active', isDeleted: false, role: 'CUSTOMER', tokenVersion: 0,
      registerOtp: otp.hashOtp('123456'), registerOtpExpire: new Date(Date.now() + 60000), registrationIntent: 'CUSTOMER' };
  }
  for (const method of ['google', 'facebook']) {
    for (const verified of [false, true]) {
      reset(verified);
      if (method === 'google') await auth.googleLogin({ credential: 'du-lieu-gia' });
      else await auth.facebookLogin('du-lieu-gia');
      assert.equal(stored.isEmailVerified, true);
      assert.equal(stored.passwordHash, verified ? passwordHash : null);
      if (!verified) {
        assert.equal(stored.registerOtp, undefined);
        assert.equal(stored.registrationIntent, undefined);
        await assert.rejects(auth.login(stored.email, oldPassword), /không hỗ trợ/);
      } else await auth.login(stored.email, oldPassword);
    }
  }
  for (const activate of ['otp', 'oauth']) {
    reset(); holdHash = deferred(); hashStarted = deferred();
    const registering = auth.register({ email: stored.email, password: 'MatKhauMoi123!', fullName: 'Tên Mới' });
    await hashStarted.promise;
    if (activate === 'otp') await auth.verifyRegisterOtp(stored.email, '123456');
    else await auth.googleLogin({ credential: 'du-lieu-gia' });
    const activatedHash = stored.passwordHash;
    holdHash.resolve();
    await assert.rejects(registering, /đã thay đổi/);
    holdHash = null;
    assert.equal(stored.passwordHash, activatedHash);
    assert.equal(stored.registerOtp, undefined);
  }
  reset();
  beforeUpdate = async () => { stored.registerOtp = otp.hashOtp('654321'); stored.passwordHash = 'mat-khau-da-doi'; };
  await assert.rejects(auth.verifyRegisterOtp(stored.email, '123456'), /đã thay đổi/);
  assert.equal(stored.isEmailVerified, false);
  console.log('Đạt KH-14, KH-15: OAuth, đăng ký chậm và OTP đã thay đổi.');
}
async function supportCases() {
  const requester = new mongoose.Types.ObjectId();
  const admin = new mongoose.Types.ObjectId();
  let stored;
  let paused;
  let reached;
  function document() {
    const doc = SupportTicket.hydrate(stored);
    doc.save = async () => {
      const [filter, update] = doc.$__delta();
      Object.assign(filter, doc.$where);
      if (paused && doc.responses.length) { reached.resolve(); await paused.promise; }
      if (!matches(stored, filter)) throw Object.assign(new Error('Xung đột'), { name: 'VersionError' });
      apply(stored, update);
      return doc;
    };
    return doc;
  }
  const query = value => ({ populate: async () => value, select: async () => value });
  const model = {
    findOne: () => Object.assign(Promise.resolve(document()), query(document())),
    findById: () => query(document()),
    findOneAndUpdate: (filter, update) => ({ populate: async () => {
      // Mô phỏng admin hoàn tất yêu cầu sau lúc phân công đọc trạng thái cũ.
      stored.status = 'resolved'; stored.__v++;
      if (!matches(stored, filter)) return null;
      const changes = Object.fromEntries(Object.entries(update).filter(([key]) => !key.startsWith('$')));
      apply(stored, { ...update, $set: changes });
      return document();
    } }),
  };
  const service = load('../services/supportTicket.service', {
    '../models/supportTicket.model': { SupportTicket: model }, '../utils/appError': { AppError },
    '../models/order.model': {}, '../models/provider.model': {}, '../models/user.model': { exists: async () => ({}) },
  });
  for (const target of ['resolved', 'cancelled']) {
    stored = new SupportTicket({ requesterId: requester, status: 'waiting_user', subject: 'Hỗ trợ',
      description: 'Nội dung yêu cầu', category: 'OTHER', responses: [], attachments: [], __v: 0 }).toObject();
    paused = deferred(); reached = deferred();
    const reply = service.addSupportTicketResponse(String(requester), 'CUSTOMER', String(stored._id), { message: 'Phản hồi chậm' });
    await reached.promise;
    if (target === 'resolved') await service.updateSupportTicketStatus(String(admin), String(stored._id), { status: 'resolved' });
    else await service.cancelSupportTicket(String(requester), String(stored._id));
    paused.resolve();
    await assert.rejects(reply, /đã thay đổi/);
    assert.equal(stored.status, target);
    assert.equal(stored.responses.length, 0);
    assert.ok(stored.resolvedAt);
    assert.equal(stored.__v, 1);
  }
  paused = null;
  await service.updateSupportTicketStatus(String(admin), String(stored._id), { status: 'cancelled' });
  stored.status = 'resolved';
  await service.updateSupportTicketStatus(String(admin), String(stored._id), { status: 'in_progress' });
  assert.equal(stored.status, 'in_progress'); assert.equal(stored.resolvedAt, null);
  await assert.rejects(service.assignSupportTicket(String(admin), String(stored._id)), /đã thay đổi/);
  assert.equal(stored.status, 'resolved');
  console.log('Đạt KH-18: phản hồi chậm không mở lại yêu cầu đã xử lý hoặc đã hủy.');
}
async function rewardCases() {
  let balance = 2000;
  let validityDays = 30;
  let offer = { id: 'GOI', name: 'Gói ưu đãi', points: 500, discountValue: 20000, minOrderAmount: 0,
    discountType: 'AMOUNT', applicableOrderType: 'fixed_price', isActive: true };
  const transactions = new Map();
  const vouchers = new Map();
  const service = load('../services/reward.service', {
    mongoose: { __esModule: true, default: { connection: { transaction: async fn => fn({}) } }, Types: mongoose.Types },
    '../models/reward.model': {
      RewardAccount: { findOneAndUpdate: async (_filter, update) => { balance += update.$inc.balance; return { balance }; } },
      RewardTransaction: { findById: key => ({ session: async () => transactions.get(key) }),
        create: async rows => { transactions.set(rows[0]._id, rows[0]); } },
    },
    '../models/voucher.model': { Voucher: { create: async rows => {
      const voucher = { ...rows[0], _id: new mongoose.Types.ObjectId() }; vouchers.set(String(voucher._id), voucher); return [voucher];
    } } },
    './voucherStore.service': { findStoredVoucher: async filter => vouchers.get(String(filter._id)) },
    '../models/order.model': {}, '../models/repairQuotation.model': {},
    '../configs/rewards': {}, '../utils/appError': { AppError },
    './systemConfig.service': { getRewardOffers: async () => [offer], getRewardPolicy: async () => ({ validityDays }) },
    '../validations/reward.validator': {},
  });
  const original = { ...offer };
  const version = service.rewardTermsVersion(offer, validityDays);
  for (const changes of [{ points: 1000 }, { discountValue: 10000 }, { minOrderAmount: 100000 },
    { discountType: 'PERCENT' }, { applicableOrderType: 'variable_price' }, { maxDiscountAmount: 5000 }, { name: 'Gói mới' }]) {
    offer = { ...original, ...changes };
    await assert.rejects(service.redeemReward('khach', 'GOI', 'yeu-cau', version), /đã thay đổi/);
    assert.equal(balance, 2000); assert.equal(vouchers.size, 0);
  }
  offer = original; validityDays = 7;
  await assert.rejects(service.redeemReward('khach', 'GOI', 'yeu-cau', version), /đã thay đổi/);
  await assert.rejects(service.redeemReward('khach', 'GOI', 'yeu-cau'), /đã thay đổi/);
  validityDays = 30;
  const voucher = await service.redeemReward('khach', 'GOI', 'yeu-cau', version);
  assert.equal(balance, 1500); assert.equal(voucher.discountValue, 20000);
  offer = { ...offer, points: 1000, isActive: false }; validityDays = 7;
  assert.equal(await service.redeemReward('khach', 'GOI', 'yeu-cau', version), voucher);
  assert.equal(balance, 1500);
  console.log('Đạt KH-16: điều kiện đổi thay đổi không trừ điểm; phát lại không đổi kết quả.');
}
async function ratingCases() {
  const providerId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const orders = [0, 1, 2].map(() => ({ _id: new mongoose.Types.ObjectId(), customerId, providerId,
    serviceId: new mongoose.Types.ObjectId(), status: 'completed', isDeleted: false }));
  let state = { version: 0, feedbacks: [], averageRating: 0, totalFeedbacks: 0 };
  const paused = deferred();
  const reached = deferred();
  let first = true;
  let failStats = false;
  let attempts = 0;
  const transaction = load('../utils/transaction', { './logger': { createLogger: () => ({ warn() {} }) } });
  const sessions = {
    startSession: async () => ({
      async withTransaction(operation) {
        attempts++;
        this.snapshot = { ...state, feedbacks: state.feedbacks.map(row => ({ ...row })) };
        const result = await operation(this);
        if (this.snapshot.version !== state.version) throw Object.assign(new Error('Xung đột ghi'), { code: 112 });
        state = { ...this.snapshot, version: state.version + 1 };
        return result;
      },
      async endSession() {},
    }),
  };
  const feedbackModel = {
    findOne: filter => ({ session: async session => {
      const row = session.snapshot.feedbacks.find(item => matches(item, filter));
      if (!row) return null;
      return { ...row, save: async function (options) {
        assert.equal(options.session, session); Object.assign(row, this);
      } };
    } }),
    create: async (rows, { session }) => {
      const feedback = { ...rows[0], _id: new mongoose.Types.ObjectId(), isDeleted: false, isVisible: true };
      session.snapshot.feedbacks.push(feedback); return [feedback];
    },
    findOneAndUpdate: async (filter, update, { session, runValidators }) => {
      assert.equal(runValidators, true);
      const row = session.snapshot.feedbacks.find(item => matches(item, filter));
      if (!row) return null;
      Object.assign(row, update.$set ?? update); return row;
    },
    aggregate: () => ({ session: async session => {
      assert.ok(session.locked, 'Phải ghi khóa hồ sơ thợ trước khi tổng hợp.');
      const visible = session.snapshot.feedbacks.filter(row => row.isVisible && !row.isDeleted);
      return visible.length ? [{ totalFeedbacks: visible.length,
        averageRating: visible.reduce((sum, row) => sum + row.rating, 0) / visible.length }] : [];
    } }),
  };
  const service = load('../services/feedback.service', {
    mongoose: { __esModule: true, default: sessions, Types: mongoose.Types },
    '../utils/transaction': transaction, '../utils/serviceImageResponse': {}, '../utils/appError': { AppError },
    '../models/feedback.model': { Feedback: feedbackModel },
    '../models/order.model': { Order: {
      findOne: filter => ({ session: async () => orders.find(row => matches(row, filter)) }),
      find: () => ({ session: session => ({ distinct: async () => {
        assert.ok(session); return orders.map(row => row._id);
      } }) }),
    } },
    '../models/provider.model': { Provider: {
      findOneAndUpdate: async (_filter, update, { session, runValidators }) => {
        assert.equal(update.$inc.__v, 1); assert.equal(runValidators, true); session.locked = true; return {};
      },
      findByIdAndUpdate: async (_id, stats, { session, runValidators }) => {
        assert.equal(runValidators, true);
        if (failStats) throw new Error('Lỗi lưu thống kê giả lập');
        if (first) { first = false; reached.resolve(); await paused.promise; }
        Object.assign(session.snapshot, stats);
      },
    } },
    '../models/orderStatus.model': {}, '../models/service.model': {},
  });
  const create = (index, rating) => service.createFeedback(String(customerId), { orderId: String(orders[index]._id), rating });
  const firstCreate = create(0, 5);
  await reached.promise;
  await create(1, 1);
  paused.resolve(); await firstCreate;
  assert.equal(state.feedbacks.length, 2); assert.equal(state.averageRating, 3); assert.equal(state.totalFeedbacks, 2);
  assert.equal(attempts, 3, 'Lượt cũ phải thử lại toàn bộ giao dịch sau xung đột.');
  const feedback = state.feedbacks.find(row => row.rating === 5);
  await service.updateMyFeedback(String(customerId), String(feedback._id), { rating: 1 });
  assert.equal(state.averageRating, 1); assert.equal(state.totalFeedbacks, 2);
  await service.setFeedbackVisibility(String(feedback._id), false);
  assert.equal(state.averageRating, 1); assert.equal(state.totalFeedbacks, 1);
  failStats = true;
  await assert.rejects(create(2, 5), /Lỗi lưu thống kê/);
  assert.equal(state.feedbacks.length, 2, 'Lỗi thống kê phải hoàn tác cả đánh giá mới.');
  assert.equal(state.totalFeedbacks, 1);
  console.log('Đạt KH-19: hai lượt đồng thời, sửa/ẩn đánh giá và hoàn tác khi lỗi.');
}
async function run() { await authCases(); await supportCases(); await rewardCases(); await ratingCases(); }
run().catch(error => { console.error(error); process.exitCode = 1; });
