const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const { AppError } = require('../utils/appError');
const { withTransactionRetry } = require('../utils/transaction');
const { createReportSchema } = require('../validations/report.validator');

// Chạy service thật với database giao dịch giả lập, không đọc cấu hình hoặc gọi dịch vụ ngoài.
const id = () => new Types.ObjectId().toString();
const customer = { id: id(), role: 'CUSTOMER' };
const worker = { id: id(), role: 'PROVIDER' };
const outsider = { id: id(), role: 'CUSTOMER' };
const admin = { id: id(), role: 'ADMIN' };
const bankId = id(), otherBankId = id(), walletId = id(), providerId = id(), otherProviderId = id();
const orderId = id(), foreignOrderId = id(), feedbackId = id(), conversationId = id();
let state, revision, conflicts, failCreate, failNotification, bankWrites;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const same = (a, b) => String(a) === String(b);
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Types.ObjectId)) {
      if ('$gte' in value) return row[key] >= value.$gte;
      if ('$ne' in value) return !same(row[key], value.$ne);
    }
    return same(row[key], value);
  });
}
function reset() {
  revision = 0; conflicts = 0; failCreate = false; failNotification = false; bankWrites = 0;
  state = {
    banks: [{ _id: bankId, userId: customer.id, bankName: 'Ngân hàng thử', bankCode: 'THU',
      accountNumber: '123456789', accountHolderName: 'Khách thử', isDefault: true,
      status: 'active', isDeleted: false, __v: 0 },
      { _id: otherBankId, userId: outsider.id, status: 'active', isDeleted: false, __v: 0 }],
    wallets: [{ _id: walletId, userId: customer.id, balance: 500000, pendingBalance: 0, isDeleted: false }],
    withdrawals: [], transactions: [], reports: [], notifications: [],
    providers: [{ _id: providerId, userId: worker.id, isDeleted: false },
      { _id: otherProviderId, userId: outsider.id, isDeleted: false }],
    users: [customer, worker, outsider].map(user => ({ _id: user.id, isDeleted: false })),
    orders: [{ _id: orderId, customerId: customer.id, providerId, isDeleted: false, orderCode: 'ĐƠN-THỬ' },
      { _id: foreignOrderId, customerId: outsider.id, providerId: otherProviderId, isDeleted: false }],
    feedbacks: [{ _id: feedbackId, orderId, customerId: customer.id, providerId,
      isDeleted: false, isVisible: true, comment: 'Nội dung đánh giá thử' }],
    conversations: [{ _id: conversationId, orderId, customerId: customer.id, providerId, isDeleted: false }],
  };
}
function document(name, row, session) {
  if (!row) return null;
  const value = copy(row);
  Object.defineProperty(value, 'set', { enumerable: false, value: fields => Object.assign(value, fields) });
  Object.defineProperty(value, 'save', { enumerable: false, value: async options => {
    assert.equal(options?.session, session);
    const store = session ? session.snapshot : state;
    const at = store[name].findIndex(item => same(item._id, value._id));
    assert.ok(at >= 0);
    store[name][at] = copy(value);
  } });
  return value;
}
function query(operation) {
  const context = {};
  const result = {
    session(value) { context.session = value; return result; },
    select() { return result; }, sort() { return result; },
    skip(value) { context.skip = value; return result; },
    limit(value) { context.limit = value; return result; },
    populate(value) { context.populate = value; return result; },
    then(resolve, reject) { return Promise.resolve().then(() => operation(context)).then(resolve, reject); },
  };
  return result;
}
function populate(row, specs) {
  if (!row || !specs) return row;
  for (const spec of specs) {
    const collection = { orderId: 'orders', targetFeedbackId: 'feedbacks' }[spec.path];
    if (collection && row[spec.path]) {
      row[spec.path] = copy(state[collection].find(item => same(item._id, row[spec.path]) &&
        (!spec.match || matches(item, spec.match))) ?? null);
    }
  }
  return row;
}
function collection(name) {
  const read = (filter, many = false) => query(context => {
    const store = context.session ? context.session.snapshot : state;
    let rows = store[name].filter(row => matches(row, filter));
    if (context.skip) rows = rows.slice(context.skip);
    if (context.limit) rows = rows.slice(0, context.limit);
    const values = rows.map(row => populate(document(name, row, context.session), context.populate));
    return many ? values : values[0] ?? null;
  });
  return {
    findOne: filter => read(filter), find: filter => read(filter, true),
    findById: value => read({ _id: value }),
    exists: filter => read(filter),
    countDocuments: filter => query(context => (context.session ? context.session.snapshot : state)[name]
      .filter(row => matches(row, filter)).length),
    async findOneAndUpdate(filter, update, options) {
      assert.equal(options.runValidators, true);
      assert.ok(options.session, 'Cập nhật phải nằm trong giao dịch.');
      if (name === 'banks') bankWrites++;
      const row = options.session.snapshot[name].find(item => matches(item, filter));
      if (!row) return null;
      for (const [key, amount] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + amount;
      Object.assign(row, copy(update.$set ?? Object.fromEntries(Object.entries(update).filter(([key]) => !key.startsWith('$')))));
      return document(name, row, options.session);
    },
    async updateMany(filter, update, options) {
      assert.equal(options.runValidators, true);
      for (const row of options.session.snapshot[name].filter(item => matches(item, filter))) Object.assign(row, update.$set);
    },
    async create(values, options) {
      if (failCreate && name === 'withdrawals') throw new Error('Lỗi tạo yêu cầu giả lập');
      const rows = (Array.isArray(values) ? values : [values]).map(value => ({ _id: id(), isDeleted: false, ...copy(value) }));
      (options?.session ? options.session.snapshot : state)[name].push(...rows);
      return Array.isArray(values) ? rows : rows[0];
    },
  };
}
const models = Object.fromEntries(['banks', 'wallets', 'withdrawals', 'transactions', 'providers',
  'users', 'orders', 'feedbacks', 'conversations', 'reports'].map(name => [name, collection(name)]));
const mongoose = {
  Types,
  async startSession() {
    return {
      async withTransaction(operation) {
        const start = revision;
        this.snapshot = copy(state);
        const result = await operation(this);
        if (start !== revision) {
          conflicts++;
          throw Object.assign(new Error('Xung đột snapshot giả lập'), { code: 112 });
        }
        state = this.snapshot; revision++;
        return result;
      },
      async endSession() {},
    };
  },
  connection: { async transaction(operation) {
    const session = await mongoose.startSession();
    try { return await withTransactionRetry(session, operation); }
    finally { await session.endSession(); }
  } },
};
function load(file) {
  const context = { exports: {}, require: name => {
    const mapping = {
      mongoose: { ...mongoose, default: mongoose, __esModule: true },
      '../models/bankAccount.model': { BankAccount: models.banks },
      '../models/withdrawRequest.model': { WithdrawRequest: models.withdrawals },
      '../models/wallet.model': { Wallet: models.wallets },
      '../models/walletTransaction.model': { WalletTransaction: models.transactions },
      '../models/provider.model': { Provider: models.providers },
      '../models/user.model': { default: models.users, __esModule: true },
      '../models/order.model': { Order: models.orders },
      '../models/feedback.model': { Feedback: models.feedbacks },
      '../models/conversation.model': { Conversation: models.conversations },
      '../models/report.model': { Report: models.reports },
      '../validations/report.validator': { createReportSchema },
      '../utils/appError': { AppError },
      '../utils/logger': { createLogger: () => ({ warn() {} }) },
      '../utils/transaction': { withTransactionRetry, buildTransactionCode: () => 'RÚT-THỬ' },
      '../utils/mongo': { toObjectId: value => new Types.ObjectId(value) },
      './systemConfig.service': { getNumberConfigValue: async (_, fallback) => fallback },
      './notification.service': { createNotificationRecord: async (value, options) => {
        if (failNotification) throw new Error('Lỗi lưu thông báo giả lập');
        assert.equal(options.deferRealtime, true, 'Thông báo rút tiền phải đợi commit.');
        options.session.snapshot.notifications.push(copy(value));
        return value;
      }, emitRealtimeNotification: value => {
        const withdrawal = state.withdrawals.find(row => String(row._id) === String(value.data.withdrawalId));
        assert.equal(withdrawal.status, value.data.status, 'Chỉ phát trạng thái rút tiền đã commit.');
      } },
    };
    assert.ok(name in mapping, `Không được tải phụ thuộc ngoài giả lập: ${name}`);
    return mapping[name];
  }, Date };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const reports = load('../services/report.service');
const banks = load('../services/bankAccount.service');
const withdrawals = load('../services/withdrawal.service');
const baseReport = { reportType: 'other', title: 'Báo cáo kiểm thử', description: 'Nội dung báo cáo kiểm thử hợp lệ' };
const report = (user, payload) => reports.createReport(user.id, user.role, { ...baseReport, ...payload });
const deposit = () => withdrawals.createWithdrawal(customer, { amount: 100000, bankAccountId: bankId });
const errorStatus = status => error => error instanceof AppError && error.statusCode === status;
async function testReports() {
  reset();
  // Các payload đang được giao diện gửi vẫn được nhận, đối tượng được suy ra đúng.
  let result = await report(customer, { targetType: 'provider', targetProviderId: providerId, orderId });
  assert.equal(String(result.targetUserId), worker.id);
  result = await report(worker, { targetType: 'user', targetUserId: customer.id, orderId });
  assert.equal(String(result.targetUserId), customer.id);
  await report(customer, { targetType: 'order', orderId });
  await report(customer, { targetType: 'order', orderId, targetUserId: worker.id });
  await report(customer, { targetType: 'chat_conversation', conversationId });
  await report(worker, { targetType: 'feedback', targetFeedbackId: feedbackId });
  await report(customer, { targetType: 'user', targetUserId: outsider.id });
  await report(customer, { targetType: 'provider', targetUserId: worker.id });

  const before = state.reports.length;
  const rejected = [
    [customer, { targetType: 'user', targetUserId: worker.id, orderId: foreignOrderId }, 403],
    [customer, { targetType: 'provider', targetProviderId: otherProviderId, orderId }, 400],
    [customer, { targetType: 'provider', targetProviderId: providerId, targetUserId: outsider.id }, 400],
    [customer, { targetType: 'user', targetUserId: worker.id, targetFeedbackId: feedbackId }, 400],
    [customer, { targetType: 'user', targetUserId: worker.id, conversationId }, 400],
    [customer, { targetType: 'order', orderId, targetUserId: outsider.id }, 400],
    [worker, { targetType: 'feedback', targetFeedbackId: feedbackId, orderId: foreignOrderId }, 400],
    [customer, { targetType: 'chat_conversation', conversationId, orderId: foreignOrderId }, 400],
    [outsider, { targetType: 'feedback', targetFeedbackId: feedbackId }, 403],
    [outsider, { targetType: 'chat_conversation', conversationId }, 403],
    [customer, { targetType: 'user', targetUserId: customer.id }, 400],
    [customer, { targetType: 'provider', targetUserId: customer.id }, 404],
    [customer, { targetType: 'order', orderId: 'sai-id' }, 400],
    [customer, { targetType: 'order' }, 400],
    [admin, { targetType: 'order', orderId }, 403],
  ];
  for (const [user, payload, status] of rejected) await assert.rejects(report(user, payload), errorStatus(status));
  assert.equal(state.reports.length, before, 'Không ghi báo cáo khi tài nguyên hoặc quyền không hợp lệ.');
  state.feedbacks[0].isVisible = false;
  await assert.rejects(report(worker, { targetType: 'feedback', targetFeedbackId: feedbackId }), errorStatus(404));
  state.feedbacks[0].isVisible = true;
  state.feedbacks[0].providerId = otherProviderId;
  await assert.rejects(report(worker, { targetType: 'feedback', targetFeedbackId: feedbackId }), errorStatus(403));
  state.feedbacks[0].providerId = providerId;
  state.feedbacks[0].isVisible = false;

  // Báo cáo cũ có liên kết giả mạo không tiếp tục trả dữ liệu qua populate.
  const legacyId = id();
  state.reports.push({ _id: legacyId, reporterId: customer.id, orderId: foreignOrderId,
    targetFeedbackId: feedbackId, isDeleted: false });
  result = await reports.getReportForUser(customer.id, legacyId);
  assert.equal(result.orderId, null); assert.equal(result.targetFeedbackId, null);
  const page = await reports.getMyReports(customer.id);
  const legacy = page.items.find(item => item._id === legacyId);
  assert.equal(legacy.orderId, null); assert.equal(legacy.targetFeedbackId, null);
  const adminReport = await reports.getAdminReportById(legacyId);
  assert.equal(adminReport.orderId._id, foreignOrderId);
  assert.equal(adminReport.targetFeedbackId._id, feedbackId);
  await assert.rejects(reports.getReportForUser(outsider.id, legacyId), errorStatus(404));
  state.feedbacks[0].isVisible = true;
  state.feedbacks[0].customerId = outsider.id; state.feedbacks[0].providerId = otherProviderId;
  assert.equal((await reports.getReportForUser(customer.id, legacyId)).targetFeedbackId, null);
}
async function testWithdrawals() {
  reset();
  const request = await deposit();
  assert.equal(state.wallets[0].balance, 400000); assert.equal(state.wallets[0].pendingBalance, 100000);
  assert.ok(bankWrites > 0, 'Tạo yêu cầu phải ghi khóa trên tài khoản nhận tiền trong cùng transaction.');
  for (const field of ['bankName', 'bankCode', 'accountNumber', 'accountHolderName']) {
    await assert.rejects(banks.updateMyBankAccount(customer, bankId, { [field]: 'Thông tin khác' }), errorStatus(409));
  }
  await assert.rejects(banks.updateMyBankAccount(customer, bankId, { status: 'inactive' }), errorStatus(409));
  await assert.rejects(banks.deleteMyBankAccount(customer, bankId), errorStatus(409));
  await banks.setDefaultMyBankAccount(customer, bankId);
  await banks.updateMyBankAccount(customer, bankId, { accountNumber: '123456789' });
  assert.equal(state.banks[0].accountNumber, '123456789');
  const added = await banks.createMyBankAccount(customer, { bankName: 'Ngân hàng khác', bankCode: 'MOI',
    accountNumber: '555555555', accountHolderName: 'Khách thử', isDefault: true });
  assert.equal(state.banks.find(bank => bank._id === added._id).isDefault, true);
  assert.equal(state.withdrawals[0].bankAccountId, bankId, 'Đổi mặc định không đổi đích của yêu cầu đã tạo.');
  await assert.rejects(banks.updateMyBankAccount(outsider, bankId, { accountNumber: 'khác' }), errorStatus(404));
  await assert.rejects(withdrawals.createWithdrawal(customer, { amount: 100000, bankAccountId: otherBankId }), errorStatus(400));

  const writesBeforeApproval = bankWrites;
  await withdrawals.approveWithdrawal(admin, request._id, {});
  assert.ok(bankWrites > writesBeforeApproval, 'Duyệt phải khóa và xác minh lại tài khoản nhận tiền.');
  assert.equal(state.withdrawals[0].status, 'approved'); assert.equal(state.transactions.length, 1);
  assert.equal(state.wallets[0].pendingBalance, 0);
  await assert.rejects(withdrawals.approveWithdrawal(admin, request._id, {}), errorStatus(404));
  assert.equal(state.transactions.length, 1);
  await assert.rejects(banks.updateMyBankAccount(customer, bankId, { accountNumber: 'khác' }), errorStatus(409));
  await banks.deleteMyBankAccount(customer, bankId);
  assert.equal(state.banks[0].isDeleted, true);
  assert.equal(state.banks[0].accountNumber, '123456789', 'Xóa mềm không làm mất thông tin nhận tiền lịch sử.');
  const restoreInput = { bankName: 'Ngân hàng thử', bankCode: 'THU',
    accountNumber: '123456789', accountHolderName: 'Khách thử' };
  const beforeRestore = copy(state);
  await assert.rejects(banks.createMyBankAccount(customer, { ...restoreInput, accountHolderName: 'Người khác' }), errorStatus(409));
  assert.deepEqual(state, beforeRestore, 'Khôi phục thất bại không đổi thông tin lịch sử hoặc mặc định.');
  const restored = await banks.createMyBankAccount(customer, restoreInput);
  assert.equal(restored._id, bankId); assert.equal(restored.isDeleted, false);
  assert.equal(restored.deletedAt, null); assert.equal(restored.status, 'active');
  assert.equal(restored.isDefault, false, 'Giữ mặc định đang có nếu không yêu cầu đổi.');
  assert.equal(state.withdrawals[0].bankAccountId, restored._id);
  await assert.rejects(banks.createMyBankAccount(customer, restoreInput), errorStatus(409));
  await banks.deleteMyBankAccount(customer, bankId);
  const restoredDefault = await banks.createMyBankAccount(customer, { ...restoreInput, isDefault: true });
  assert.equal(restoredDefault.isDefault, true);
  assert.equal(state.banks.filter(row => row.userId === customer.id && row.isDefault).length, 1);

  reset();
  await banks.deleteMyBankAccount(customer, bankId);
  const concurrent = await Promise.allSettled([
    banks.createMyBankAccount(customer, restoreInput), banks.createMyBankAccount(customer, restoreInput),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(state.banks.filter(row => row.userId === customer.id && !row.isDeleted).length, 1);
  assert.equal(state.banks[0].isDefault, true, 'Khôi phục tài khoản duy nhất phải đặt làm mặc định.');
  // Cùng thông tin ngân hàng của tài khoản khác không được khôi phục nhầm chủ sở hữu.
  const foreign = await banks.createMyBankAccount(outsider, restoreInput);
  assert.notEqual(foreign._id, bankId); assert.equal(foreign.userId, outsider.id);

  for (const change of [{ status: 'inactive' }, { isDeleted: true }, { userId: outsider.id }]) {
    reset(); const pending = await deposit(); Object.assign(state.banks[0], change);
    const before = copy(state);
    await assert.rejects(withdrawals.approveWithdrawal(admin, pending._id, {}), errorStatus(409));
    assert.deepEqual(state, before, 'Tài khoản cũ không hợp lệ không được duyệt hoặc trừ tiền đang chờ.');
    await withdrawals.rejectWithdrawal(admin, pending._id, {});
    assert.equal(state.wallets[0].balance, 500000); assert.equal(state.wallets[0].pendingBalance, 0);
  }
  reset(); failCreate = true;
  await assert.rejects(deposit(), /Lỗi tạo/);
  assert.equal(state.wallets[0].balance, 500000); assert.equal(state.banks[0].__v, 0);
  reset(); const pending = await deposit(); failNotification = true;
  await assert.rejects(withdrawals.approveWithdrawal(admin, pending._id, {}), /Lỗi lưu/);
  assert.equal(state.wallets[0].pendingBalance, 100000);
  assert.equal(state.withdrawals[0].status, 'pending'); assert.equal(state.transactions.length, 0);

  // Xung đột commit buộc đọc lại các tham chiếu, không cho sửa/xóa sau khi yêu cầu được tạo.
  for (const operation of [
    () => banks.updateMyBankAccount(customer, bankId, { accountNumber: '987654321' }),
    () => banks.deleteMyBankAccount(customer, bankId),
    () => banks.updateMyBankAccount(customer, bankId, { status: 'inactive' }),
  ]) {
    reset();
    const results = await Promise.allSettled([deposit(), operation()]);
    assert.ok(conflicts > 0, 'Mô phỏng phải thực sự phát sinh xung đột snapshot.');
    if (state.withdrawals.length) {
      assert.equal(state.banks[0].isDeleted, false); assert.equal(state.banks[0].status, 'active');
      const destination = state.banks[0].accountNumber;
      await assert.rejects(banks.updateMyBankAccount(customer, bankId, { accountNumber: 'sửa sau tạo' }), errorStatus(409));
      assert.equal(state.banks[0].accountNumber, destination);
    } else {
      assert.equal(state.wallets[0].balance, 500000);
    }
    assert.ok(results.some(result => result.status === 'fulfilled'));
  }
  reset();
  await banks.updateMyBankAccount(customer, bankId, { accountNumber: '987654321' });
  assert.equal(state.banks[0].accountNumber, '987654321', 'Tài khoản chưa được dùng vẫn sửa bình thường.');
  await deposit();
  await assert.rejects(banks.updateMyBankAccount(customer, bankId, { accountNumber: '123456789' }), errorStatus(409));
  reset();
  const rejected = await deposit();
  await withdrawals.rejectWithdrawal(admin, rejected._id, {});
  await assert.rejects(banks.updateMyBankAccount(customer, bankId, { bankCode: 'KHAC' }), errorStatus(409));
  await banks.updateMyBankAccount(customer, bankId, { status: 'inactive' });
  assert.equal(state.banks[0].status, 'inactive', 'Yêu cầu kết thúc cho phép vô hiệu hóa, vẫn giữ thông tin lịch sử.');
}
(async () => {
  await testReports(); await testWithdrawals();
  console.log('Đạt: quyền/ngữ cảnh báo cáo, bảo vệ báo cáo cũ, khóa đích rút tiền, đối soát tài khoản khi duyệt, rollback và thao tác đồng thời.');
})().catch(error => { console.error(error); process.exitCode = 1; });
