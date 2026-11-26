const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

// Chạy code thật; thay database/gateway bằng dữ liệu giả, không đọc cấu hình bí mật.
const root = path.resolve(__dirname, '../src');
function loader(mocks = {}) {
  const cache = new Map();
  const mongoose = require('mongoose');
  const isolated = { ...mongoose, model: mongoose.model.bind(new mongoose.Mongoose()) };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, Date, Map, Set, Buffer, URL, AbortSignal, JSON, structuredClone, console, setTimeout, clearTimeout,
      process: { env: {} }, require(name) {
        const key = Object.keys(mocks).find(key => name.endsWith(key));
        if (key) return mocks[key];
        if (name === 'mongoose') return isolated;
        return name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name);
      } }, { filename });
    return exports;
  }
  return load;
}
const user = { id: '111111111111111111111111', role: 'CUSTOMER' };
const orderId = '222222222222222222222222';
const resourceId = '333333333333333333333333';
const bankId = '444444444444444444444444';
const signal = () => new AbortController().signal;
const query = value => ({ select() { return this; }, lean: async () => value, sort() { return this; },
  populate() { return this; }, session() { return this; }, skip() { return this; }, limit() { return this; },
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });

function reportFixture() {
  let own = true, status = 'pending', noShow = false, conversation = true, failure = false;
  const writes = [];
  let files = [];
  const record = () => ({ _id: resourceId, reporterId: user.id, title: 'Thợ có hành vi quấy rối', description: 'Mô tả sự việc cần xem xét.',
    status, isCustomerNoShow: noShow, createdAt: new Date('2030-01-01'), reportType: 'harassment', targetType: 'order',
    orderId: { _id: orderId, orderCode: 'ORD-TEST' }, evidenceFiles: files,
    handledBy: { email: 'admin-private', phone: 'admin-phone' }, internalNote: 'private-note', createdViolationId: 'private-violation' });
  const mocks = {
    '/supportTicket.service': {}, '/complaint.service': {}, '/agentOrderProgress.service': {},
    '/agentBooking.service': { AgentBookingService: { getBooking: async (id, order) => {
      assert.equal(id, user.id); assert.equal(order, orderId); if (!own) throw new Error('Không có quyền xem đơn');
      return { orderId, orderCode: 'ORD-TEST' };
    } } },
    '/conversation.model': { Conversation: { findOne: filter => {
      assert.equal(filter.customerId, user.id); return query(conversation ? { _id: resourceId } : null);
    } } },
    '/report.service': {
      REPORT_TERMINAL_STATUSES: ['confirmed', 'resolved', 'rejected', 'cancelled'],
      resolveReportTarget: async (id, role, args) => { assert.equal(id, user.id); assert.equal(role, 'CUSTOMER');
        if (!own) throw new Error('Không có quyền báo cáo');
        return { orderId: args.targetType === 'system' || args.targetType === 'app' ? null : orderId };
      },
      createReport: async (...args) => { writes.push(args); if (failure) throw new Error('Mất kết nối sau ghi'); return record(); },
      getReportForUser: async id => { assert.equal(id, user.id); if (!own) throw new Error('Không tìm thấy báo cáo'); return record(); },
      getMyReports: async () => ({ items: [record()], pagination: { page: 1 } }),
      cancelReport: async () => { writes.push('cancel'); status = 'cancelled'; return record(); },
      addReportEvidence: async (_id, role, _report, args) => { assert.equal(role, 'CUSTOMER'); writes.push(args); return record(); },
    },
  };
  const load = loader(mocks);
  return { load, service: load('services/agentReport.service.ts').AgentReportService,
    schema: load('services/agentReport.service.ts').agentReportSchema, writes,
    setOwn: v => own = v, setStatus: v => status = v, setNoShow: v => noShow = v,
    setConversation: v => conversation = v, setFailure: v => failure = v, setFiles: v => files = v };
}
const reportArgs = { targetType: 'order', orderId, reportType: 'harassment', title: 'Thợ có hành vi quấy rối', description: 'Mô tả sự việc cần xem xét.' };

test('Báo cáo hành vi kiểm tra đầu vào, không nhận danh tính/ảnh giả hoặc dùng sai luồng chất lượng', () => {
  const { schema } = reportFixture();
  assert.equal(schema.safeParse(reportArgs).success, true);
  for (const change of [{ userId: user.id }, { reporterId: user.id }, { role: 'ADMIN' }, { targetProviderId: bankId },
    { evidenceImages: ['https://fake/image'] }, { reportType: 'service_quality' }, { orderId: undefined },
    { targetType: 'chat_conversation', conversationId: undefined }, { targetType: 'app' }, { conversationId: resourceId },
    { title: '' }, { description: 'ngắn' }, { customerAttachments: Array(5).fill('https://fake/image') }]) {
    assert.equal(schema.safeParse({ ...reportArgs, ...change }).success, false, JSON.stringify(change));
  }
});

test('Báo cáo hành vi không cần đơn hoàn thành, đúng ngữ cảnh và loại bỏ dữ liệu admin khỏi mọi kết quả', async () => {
  const f = reportFixture();
  const preview = await f.service.preview(user.id, reportArgs);
  assert.equal(preview.orderCode, 'ORD-TEST'); assert.equal(f.writes.length, 0);
  const created = await f.service.create(user.id, reportArgs, 'session', 'action');
  const list = await f.service.list(user.id, {});
  assert.equal(created.reportType, 'harassment'); assert.equal(list.items[0].targetType, 'order');
  assert.equal(f.writes[0][1], 'CUSTOMER'); assert.equal(f.writes[0][2].evidenceImages.length, 0);
  assert.doesNotMatch(JSON.stringify([preview, created, list]), /admin-private|admin-phone|private-note|private-violation/);
  await assert.rejects(f.service.create(user.id, reportArgs, 'session'), /Thiếu mã hành động/);
});

test('Báo cáo chặn đơn/cuộc trò chuyện người khác; không có chat vẫn báo cáo đơn, lỗi ứng dụng không cần đơn', async () => {
  const f = reportFixture(); f.setConversation(false);
  assert.equal((await f.service.context(user.id, orderId)).conversationId, null);
  assert.equal((await f.service.preview(user.id, { ...reportArgs, targetType: 'app', orderId: undefined, reportType: 'system_bug' })).orderCode, 'Không gắn với đơn dịch vụ');
  f.setOwn(false);
  await assert.rejects(f.service.context(user.id, orderId), /Không có quyền/);
  await assert.rejects(f.service.preview(user.id, reportArgs), /Không có quyền/);
  await assert.rejects(f.service.preview(user.id, { ...reportArgs, targetType: 'chat_conversation', conversationId: resourceId, orderId: undefined }), /Không có quyền/);
  await assert.rejects(f.service.detail(user.id, resourceId), /Không tìm thấy/); assert.equal(f.writes.length, 0);
});

test('Hủy/bổ sung báo cáo chặn mọi trạng thái kết thúc, hồ sơ xác minh riêng và ảnh rỗng', async () => {
  const f = reportFixture();
  for (const state of ['confirmed', 'resolved', 'rejected', 'cancelled']) {
    f.setStatus(state);
    await assert.rejects(f.service.previewAction(user.id, resourceId), /đã kết thúc/);
    await assert.rejects(f.service.previewAction(user.id, resourceId, ['https://owned/img']), /đã kết thúc/);
  }
  f.setStatus('pending'); f.setNoShow(true);
  await assert.rejects(f.service.previewAction(user.id, resourceId), /quy trình xác minh/);
  f.setNoShow(false);
  await assert.rejects(f.service.previewAction(user.id, resourceId, []), /ít nhất một ảnh/);
  assert.equal((await f.service.previewAction(user.id, resourceId, ['https://owned/img'])).customerAttachments.length, 1);
  assert.equal(f.writes.length, 0);
});

test('Bằng chứng chỉ lấy ảnh đúng phiên và chốt vào bản xác nhận; ảnh khác phiên bị chặn', async () => {
  const f = reportFixture(); const tools = f.load('ai/tools/implementations/report.tools.ts');
  const { ConfirmationService } = f.load('ai/agent/confirmation.service.ts');
  const url = 'https://owned/img';
  const ctx = { user, sessionId: 'session', signal: signal(), session: { uploadedAttachments: [url], conversation: [{ role: 'user', customerAttachments: [url] }] } };
  const confirmation = await new ConfirmationService().prepare(tools.createReportTool, ctx, reportArgs);
  assert.deepEqual([...confirmation.arguments.customerAttachments], [url]);
  assert.deepEqual([...confirmation.preview.customerAttachments], [url]);
  await assert.rejects(async () => tools.createReportTool.preview(ctx, { ...reportArgs, customerAttachments: ['https://other/img'] }), /chưa được tải/);
  await assert.rejects(async () => tools.addReportEvidenceTool.preview({ ...ctx, session: { ...ctx.session, conversation: [] } }, { reportId: resourceId }), /ít nhất một ảnh/);
  ctx.session.conversation.push({ role: 'user', content: 'Xác nhận' });
  await tools.createReportTool.execute({ ...ctx, actionId: confirmation.id }, confirmation.arguments);
  assert.deepEqual([...f.writes[0][2].evidenceImages], [url]);
});

test('Đối soát báo cáo dùng ID cố định; ảnh phải đúng người, nội dung và thời điểm, không ghi lại', async () => {
  const f = reportFixture();
  const first = await f.service.create(user.id, reportArgs, 'session', 'action');
  const id1 = String(f.writes[0][3]);
  await f.service.create(user.id, reportArgs, 'session', 'action');
  assert.equal(String(f.writes[1][3]), id1);
  assert.equal((await f.service.reconcileCreated(user.id, 'session', 'action')).id, first.id);
  const url = 'https://owned/img', start = '2030-01-01T00:00:00Z';
  f.setFiles([{ uploadedBy: user.id, fileType: 'image', url, note: 'Bằng chứng', uploadedAt: new Date('2030-01-02') }]);
  assert.ok(await f.service.reconcileEvidence(user.id, resourceId, [url], 'Bằng chứng', start));
  for (const args of [[[url], 'Khác', start], [[url], 'Bằng chứng', '2031-01-01'], [[], undefined, start], [[url], 'Bằng chứng', 'sai']]) {
    assert.equal(await f.service.reconcileEvidence(user.id, resourceId, ...args), null);
  }
  assert.equal(await f.service.reconcileCancel(user.id, resourceId), null);
  f.setStatus('cancelled'); assert.ok(await f.service.reconcileCancel(user.id, resourceId));
  assert.equal(f.writes.length, 2);
});

function withdrawalFixture() {
  let balance = 500000, pending = 0, active = true, bankOwner = true, minimum = 10000, maximum = 1000000;
  let transactionFailure = false, changeAtLock = false;
  let record = null, bankName = 'Ngân hàng A';
  let writes = 0;
  const account = () => ({ _id: bankId, userId: user.id, bankName, bankCode: 'TEST', accountNumber: '123456789', accountHolderName: 'KHÁCH HÀNG', status: active ? 'active' : 'inactive', isDefault: true });
  const bank = { findOne: filter => {
    assert.equal(filter.userId, user.id); return query(active && bankOwner ? account() : null);
  }, findOneAndUpdate: async filter => { assert.equal(filter.userId, user.id); if (!active || !bankOwner) return null;
    if (changeAtLock) bankName = 'Ngân hàng đã thay đổi'; return account(); } };
  const load = loader({
    '/bankAccount.model': { BankAccount: bank }, '/provider.model': { Provider: {} },
    '/notification.service': {}, '/walletTransaction.model': {}, '/logger': { createLogger: () => ({}) },
    '/systemConfig.service': { getNumberConfigValue: async key => key === 'MIN_WITHDRAW_AMOUNT' ? minimum : maximum },
    '/wallet.model': { Wallet: {
      findOne: filter => { assert.equal(filter.userId, user.id); return query({ balance }); },
      findOneAndUpdate: async filter => { assert.equal(filter.userId, user.id); if (balance < filter.balance.$gte) return null;
        balance -= filter.balance.$gte; pending += filter.balance.$gte; writes++; return { _id: orderId }; },
    } },
    '/withdrawRequest.model': { WithdrawRequest: {
      findOne: filter => { assert.equal(filter.userId, user.id); return query(record && String(record._id) === String(filter._id) ? record : null); },
      create: async ([args]) => { if (transactionFailure) throw new Error('Lỗi lưu yêu cầu'); record = { ...args, createdAt: new Date() }; return [record]; },
    } },
    '/transaction': { buildTransactionCode: () => 'TEST', withTransactionRetry: async (_session, work) => {
      const before = { balance, pending, record };
      try { return await work(); } catch (error) { ({ balance, pending, record } = before); throw error; }
    } },
    mongoose: { ...require('mongoose'), default: { startSession: async () => ({ endSession: async () => {} }) }, startSession: async () => ({ endSession: async () => {} }) },
  });
  return { load, service: load('services/withdrawal.service.ts'), bank: account,
    state: () => ({ balance, pending, writes, record }), setBalance: v => balance = v, setActive: v => active = v, setOwner: v => bankOwner = v,
    setLimits: (min, max) => { minimum = min; maximum = max; }, setFailure: v => transactionFailure = v,
    setBankName: v => bankName = v, setChangeAtLock: v => changeAtLock = v };
}
const withdrawalArgs = { amount: 100000, bankAccountId: bankId };

test('Rút tiền kiểm tra giới hạn, số dư và ngân hàng thuộc khách trước khi ghi', async () => {
  const f = withdrawalFixture();
  const p = await f.service.previewWithdrawal(user, withdrawalArgs);
  assert.equal(p.maskedAccountNumber, '••••6789'); assert.doesNotMatch(JSON.stringify(p), /123456789/);
  for (const amount of [0, -1, 9999, 1000001]) await assert.rejects(f.service.previewWithdrawal(user, { ...withdrawalArgs, amount }));
  f.setBalance(1); await assert.rejects(f.service.previewWithdrawal(user, withdrawalArgs), /Số dư/);
  f.setBalance(500000); f.setActive(false); await assert.rejects(f.service.previewWithdrawal(user, withdrawalArgs), /tài khoản ngân hàng/);
  f.setActive(true); f.setOwner(false); await assert.rejects(f.service.previewWithdrawal(user, withdrawalArgs), /tài khoản ngân hàng/);
  await assert.rejects(f.service.previewWithdrawal({ ...user, role: 'ADMIN' }, withdrawalArgs), /không có quyền/);
  assert.equal(f.state().writes, 0);
});

test('Rút tiền dịch chuyển số dư một lần, dùng ID cố định và phát lại không trừ ví thêm', async () => {
  const f = withdrawalFixture(); const p = await f.service.previewWithdrawal(user, withdrawalArgs);
  const options = { resourceId: new (require('mongoose').Types.ObjectId)(resourceId), expectedBankFingerprint: p.bankFingerprint };
  const first = await f.service.createWithdrawal(user, withdrawalArgs, options);
  const replay = await f.service.createWithdrawal(user, withdrawalArgs, options);
  assert.equal(String(first._id), String(replay._id)); assert.equal(first.status, 'pending');
  assert.equal(f.state().balance, 400000); assert.equal(f.state().pending, 100000); assert.equal(f.state().writes, 1);
  await assert.rejects(f.service.createWithdrawal(user, { ...withdrawalArgs, amount: 200000 }, options));
  assert.equal(f.state().balance, 400000);
});

test('Rút tiền chặn ngân hàng thay đổi trước/sát giao dịch, giới hạn mới và hoàn tác khi ghi yêu cầu lỗi', async () => {
  for (const mode of ['bank-before', 'bank-at-lock', 'limits', 'balance', 'write-failure']) {
    const f = withdrawalFixture(); const p = await f.service.previewWithdrawal(user, withdrawalArgs);
    const options = { resourceId: new (require('mongoose').Types.ObjectId)(resourceId), expectedBankFingerprint: p.bankFingerprint };
    if (mode === 'bank-before') f.setBankName('Ngân hàng B');
    if (mode === 'bank-at-lock') f.setChangeAtLock(true);
    if (mode === 'limits') f.setLimits(200000, 1000000);
    if (mode === 'balance') f.setBalance(1);
    if (mode === 'write-failure') f.setFailure(true);
    await assert.rejects(f.service.createWithdrawal(user, withdrawalArgs, options), undefined, mode);
    assert.equal(f.state().balance, mode === 'balance' ? 1 : 500000, mode);
    assert.equal(f.state().pending, 0, mode); assert.equal(f.state().record, null, mode);
  }
});

test('Đầu vào rút tiền của agent chặn số lẻ/vô hạn, thiếu ngân hàng, giả role hoặc userId', () => {
  const load = loader({ '/bankAccount.service': {}, '/withdrawal.service': {}, '/agentCustomerAccount.service': {} });
  const { agentWithdrawalSchema: schema } = load('services/agentWithdrawal.service.ts');
  assert.equal(schema.safeParse(withdrawalArgs).success, true);
  for (const amount of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(schema.safeParse({ ...withdrawalArgs, amount }).success, false);
  for (const extra of [{ bankAccountId: undefined }, { bankAccountId: 'sai' }, { role: 'ADMIN' }, { userId: user.id }, { status: 'approved' }]) {
    assert.equal(schema.safeParse({ ...withdrawalArgs, ...extra }).success, false);
  }
});

test('Tài khoản nhận tiền chỉ hiện số che, bỏ tài khoản khóa; tra rút tiền không lộ admin/ngân hàng', async () => {
  const raw = { _id: resourceId, amount: 100000, status: 'pending', createdAt: new Date(), bankAccountId: { _id: bankId, accountNumber: '123456789' },
    reviewedBy: { email: 'private-admin' }, adminNote: 'private-note' };
  const load = loader({ '/bankAccount.service': { listMyBankAccounts: async () => [
    { _id: bankId, bankName: 'A', accountNumber: '123456789', accountHolderName: 'KHÁCH', status: 'active' },
    { _id: orderId, accountNumber: '987654321', status: 'inactive' },
  ] }, '/withdrawal.service': { getMyWithdrawals: async () => ({ items: [raw], pagination: {} }), getMyWithdrawalById: async () => raw },
  '/agentCustomerAccount.service': { requireCustomerAction: (_user, id) => { assert.ok(id); return id; } } });
  const s = load('services/agentWithdrawal.service.ts').AgentWithdrawalService;
  const accounts = await s.accounts(user); assert.equal(accounts.accounts.length, 1); assert.equal(accounts.accounts[0].maskedAccountNumber, '••••6789');
  assert.doesNotMatch(JSON.stringify([accounts, await s.detail(user, resourceId), await s.list(user, { page: 1, limit: 10 })]), /123456789|987654321|private-admin|private-note/);
  await assert.rejects(s.accounts({ ...user, role: 'PROVIDER' }), /Chỉ khách hàng/);
  const found = await s.reconcile(user, withdrawalArgs, 'session', 'action'); assert.equal(found.status, 'pending');
  assert.equal(await s.reconcile(user, { ...withdrawalArgs, amount: 1 }, 'session', 'action'), null);
});

function addressFixture() {
  let own = true, exists = true, deleted = false, isDefault = false, changed = false;
  const version = '2030-01-01T00:00:00.000Z'; const writes = [];
  const address = () => exists && own ? { _id: resourceId, userId: user.id, fullAddress: 'Nhà khách', ward: 'Phường A', province: 'Đà Nẵng',
    recipientName: 'Khách', recipientPhone: '0912345678', isDeleted: deleted, isDefault, updatedAt: new Date(changed ? '2030-01-03' : version),
    deletedAt: deleted ? new Date('2030-01-02') : null } : null;
  const load = loader({ '/address.model': { Address: { findOne: filter => {
    assert.equal(filter.userId, user.id); return query(filter.isDeleted && deleted ? null : address());
  } } }, '/address.service': {
    deleteAddress: async (id, owner, expected) => { assert.equal(owner, user.id); assert.equal(expected, version); if (changed || !own || !exists) throw new Error('Địa chỉ vừa thay đổi'); writes.push('delete'); deleted = true; },
    setDefaultAddress: async (owner, id, expected) => { assert.equal(owner, user.id); assert.equal(expected, version); if (changed) throw new Error('Địa chỉ vừa thay đổi'); writes.push('default'); isDefault = true; changed = true; },
  } });
  return { load, service: load('services/agentAddressBook.service.ts').AgentAddressBookService, writes,
    setOwn: v => own = v, setExists: v => exists = v, setDeleted: v => deleted = v, setChanged: v => changed = v, setDefault: v => isDefault = v };
}

test('Sổ địa chỉ kiểm tra chủ sở hữu, mục bị xóa và địa chỉ đang dùng trong cả bản nháp active/paused', async () => {
  const f = addressFixture();
  for (const status of ['active', 'paused']) await assert.rejects(f.service.preview(user.id, resourceId, true,
    { bookingDraft: { status, values: { addressId: resourceId } } }), /đang dùng trong bản nháp/);
  f.setOwn(false); await assert.rejects(f.service.preview(user.id, resourceId, true), /thuộc tài khoản/);
  f.setOwn(true); f.setDeleted(true); await assert.rejects(f.service.preview(user.id, resourceId, true), /thuộc tài khoản/);
  f.setDeleted(false); f.setDefault(true); await assert.rejects(f.service.preview(user.id, resourceId, false), /đã là địa chỉ mặc định/);
  assert.equal(f.writes.length, 0);
});

test('Xóa và đổi mặc định kiểm tra phiên bản sát ghi, không sửa bản nháp/đơn và đối soát đúng thời điểm', async () => {
  for (const deleting of [true, false]) {
    const f = addressFixture(); const session = { bookingDraft: { status: 'active', values: { addressId: orderId } } };
    const before = JSON.stringify(session);
    const p = await f.service.preview(user.id, resourceId, deleting, session);
    assert.equal(f.writes.length, 0);
    const result = await f.service.apply(user.id, resourceId, deleting, p, session);
    assert.ok(result.message); assert.equal(f.writes.length, 1); assert.equal(JSON.stringify(session), before);
    assert.ok(await f.service.reconcile(user.id, resourceId, deleting, '2030-01-01'));
    assert.equal(await f.service.reconcile(user.id, resourceId, deleting, '2031-01-01'), null);
    assert.equal(await f.service.reconcile(user.id, resourceId, deleting, 'sai'), null);
  }
  const f = addressFixture(), p = await f.service.preview(user.id, resourceId, true); f.setChanged(true);
  await assert.rejects(f.service.apply(user.id, resourceId, true, p), /thay đổi/); assert.equal(f.writes.length, 0);
});

test('Nhóm công cụ mới chỉ cho CUSTOMER và tất cả thao tác ghi cần xác nhận, kể cả khi policy yêu cầu bỏ xác nhận', () => {
  const f = reportFixture();
  const load = loader({ '/agentReport.service': { AgentReportService: {}, agentReportSchema: f.schema },
    '/agentWithdrawal.service': { AgentWithdrawalService: {}, agentWithdrawalSchema: z.object({ amount: z.number(), bankAccountId: z.string() }).strict() },
    '/agentAddressBook.service': { AgentAddressBookService: {} } });
  const tools = [...Object.values(load('ai/tools/implementations/report.tools.ts')), ...Object.values(load('ai/tools/implementations/withdrawal.tools.ts')),
    ...Object.values(load('ai/tools/implementations/address-book.tools.ts'))];
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const { ToolExecutor } = load('ai/tools/tool-executor.ts'); const { newSession } = load('ai/agent/agent-state.ts');
  const registry = new ToolRegistry(Object.fromEntries(tools.map(t => [t.name, { requiresConfirmation: false, roles: ['ADMIN', 'PROVIDER', 'CUSTOMER'] }])));
  const session = newSession('session', user.id); const ctx = { user, session, sessionId: session.id, signal: signal() };
  for (const tool of tools) {
    registry.register(tool);
    assert.throws(() => registry.get(tool.name, { user: { ...user, role: 'ADMIN' } }), undefined, tool.name);
    assert.throws(() => registry.get(tool.name, { user: { ...user, role: 'PROVIDER' } }), undefined, tool.name);
    if (tool.mutates) {
      assert.equal(registry.needsConfirmation(tool), true, tool.name);
      assert.throws(() => registry.get(tool.name, { user, readOnly: true }));
      assert.throws(() => new ToolExecutor(registry).authorize(session, ctx, tool, {}));
    }
  }
  const groups = load('ai/tools/tool-groups.ts');
  assert.equal(groups.inferToolIntent('Tôi muốn báo cáo thợ quấy rối'), 'complaint');
  assert.equal(groups.inferToolIntent('Tôi muốn rút tiền'), 'payment');
  assert.equal(groups.inferToolIntent('Xóa địa chỉ nhà cũ'), 'booking');
});

test('Sáu thao tác mới đi qua graph: xác nhận đúng một lần, phát lại không ghi và lỗi mất kết quả được đối soát', async () => {
  const load = loader({ '/booking-draft': {}, '/agentPayment.service': {} });
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const { ConfirmationService } = load('ai/agent/confirmation.service.ts');
  const { newSession } = load('ai/agent/agent-state.ts');
  const { ActionGraphDispatcher } = load('ai/runtime/action-graph-dispatcher.ts');
  for (const name of ['create_report', 'add_report_evidence', 'cancel_report', 'create_withdrawal', 'delete_saved_address', 'set_default_address']) {
    for (const lost of [false, true]) {
      let writes = 0, record = null;
      const tool = { name, roles: ['CUSTOMER'], mutates: true, requiresConfirmation: true, inputSchema: z.object({}).strict(),
        preview: async () => ({ title: 'Xác nhận' }), execute: async () => { writes++; if (lost) throw new Error('Mất phản hồi sau ghi'); return { message: 'Đã thực hiện' }; },
        reconcile: async () => writes ? { message: 'Đã đối soát' } : null };
      const registry = new ToolRegistry().register(tool), session = newSession('session', user.id);
      const ctx = { user, session, sessionId: session.id, signal: signal() };
      const action = await new ConfirmationService().prepare(tool, ctx, {}); session.pendingAction = action;
      const ledger = { find: async () => record,
        reserve: async identity => { const inserted = !record; record ??= { ...identity, status: 'EXECUTING', startedAt: new Date().toISOString() }; return { record, inserted }; },
        settle: async (_key, status, result) => (record = { ...record, status, result }) };
      const dispatcher = new ActionGraphDispatcher(registry, ledger, async () => {});
      await assert.rejects(dispatcher.run(session, ctx, action)); assert.equal(writes, 0);
      session.activeRequest = { input: { confirmation: { actionId: action.id, decision: 'CONFIRM' } } };
      const first = await dispatcher.run(session, ctx, action);
      const replay = await dispatcher.run(first.session, { ...ctx, session: first.session }, first.action);
      assert.equal(replay.action.status, 'SUCCEEDED', name); assert.equal(writes, 1, name);
    }
  }
});

test('Graph không ghi với xác nhận hết hạn, sai role/phiên hoặc preview đã thay đổi', async () => {
  const load = loader({ '/booking-draft': {}, '/agentPayment.service': {} });
  const { ToolRegistry } = load('ai/tools/tool-registry.ts'), { ConfirmationService } = load('ai/agent/confirmation.service.ts');
  const { newSession } = load('ai/agent/agent-state.ts'), { ActionGraphDispatcher } = load('ai/runtime/action-graph-dispatcher.ts');
  for (const mode of ['expired', 'changed', 'other-user', 'provider', 'rejected']) {
    let writes = 0, title = 'Ban đầu';
    const tool = { name: 'create_withdrawal', roles: ['CUSTOMER'], mutates: true, requiresConfirmation: true,
      inputSchema: z.object({}).strict(), preview: async () => ({ title }), execute: async () => { writes++; return {}; } };
    const registry = new ToolRegistry().register(tool), session = newSession('session', user.id);
    const ctx = { user, session, sessionId: session.id, signal: signal() };
    const action = await new ConfirmationService().prepare(tool, ctx, {}); session.pendingAction = action;
    session.activeRequest = { input: { confirmation: { actionId: action.id, decision: mode === 'rejected' ? 'REJECT' : 'CONFIRM' } } };
    if (mode === 'expired') action.expiresAt = '2000-01-01T00:00:00Z';
    if (mode === 'changed') title = 'Đã đổi';
    if (mode === 'other-user') ctx.user = { ...user, id: orderId };
    if (mode === 'provider') ctx.user = { ...user, role: 'PROVIDER' };
    const dispatcher = new ActionGraphDispatcher(registry, { find: async () => null }, async () => {});
    await assert.rejects(dispatcher.run(session, ctx, action), undefined, mode); assert.equal(writes, 0, mode);
  }
});

test('Nguồn hướng dẫn đồng bộ khả năng mới và tất cả nguồn nội bộ có định danh để nhập lại', () => {
  const load = loader(); const { customerKnowledge, searchCustomerKnowledge } = load('ai/knowledge/customer-knowledge.ts');
  assert.doesNotMatch(customerKnowledge.map(x => x.content).join('\n'), /Không có tool đổi lịch|Agent chưa xóa địa chỉ/);
  assert.ok(searchCustomerKnowledge('rút tiền', 'payment').articles.some(x => x.title.includes('Rút tiền')));
  assert.ok(searchCustomerKnowledge('quấy rối', 'complaint').articles.some(x => x.title.includes('hành vi')));
  assert.ok(searchCustomerKnowledge('dời lịch đổi giờ', 'booking').articles.some(x => x.title.includes('Dời lịch')));
  assert.ok(searchCustomerKnowledge('thợ tới bao lâu GPS', 'booking').articles.some(x => x.title.includes('thời gian thợ đến')));
  const sources = load('ai/knowledge/ingestion/builtin-sources.ts').builtinKnowledgeSources();
  assert.equal(new Set(sources.map(x => x.sourceKey)).size, sources.length);
  assert.ok(sources.some(x => x.sourceKey === 'handigo/customer/withdrawal'));
  assert.ok(sources.some(x => x.sourceKey === 'handigo/customer/report'));
});

test('Lịch sử ví hỗ trợ lọc rút tiền và hoàn do từ chối, chỉ gửi đúng người dùng và không đưa metadata vào AI', async () => {
  const load = loader({ '/reward.service': {}, '/agentCustomerAccount.service': {}, '/wallet.service': {
    getWalletTransactionHistory: async (actor, args) => {
      assert.equal(actor.id, user.id); assert.ok(['withdraw', 'withdraw_rejected'].includes(args.type));
      return { items: [{ type: args.type, amount: 100000, status: 'success', metadata: { adminId: 'private-admin' } }], pagination: {} };
    },
  } });
  const tool = load('ai/tools/implementations/customer-account.tools.ts').getWalletHistoryTool;
  for (const type of ['withdraw', 'withdraw_rejected']) {
    const args = tool.inputSchema.parse({ type, page: 1 });
    const result = await tool.execute({ user }, args);
    assert.equal(result.items[0].type, type); assert.doesNotMatch(JSON.stringify(result), /private-admin|metadata/);
  }
});
