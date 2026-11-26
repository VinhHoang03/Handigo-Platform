const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
// Không khởi tạo gateway hoặc dùng thông tin xác thực thật trong bài test database.
require.cache[require.resolve('../src/configs/payos.config.ts')] = { exports: { payos: {} } };
const { MongoMemoryReplSet } = require(path.join(process.env.AGENT_CUSTOMER_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-agent-customer-test-runtime'), 'node_modules/mongodb-memory-server'));
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Wallet } = require('../src/models/wallet.model');
const { BankAccount } = require('../src/models/bankAccount.model');
const { WithdrawRequest } = require('../src/models/withdrawRequest.model');
const { Address } = require('../src/models/address.model');
const { Report } = require('../src/models/report.model');
const { Order } = require('../src/models/order.model');
const { Conversation } = require('../src/models/conversation.model');
const { AgentWithdrawalService: withdrawal } = require('../src/services/agentWithdrawal.service');
const { AgentAddressBookService: addressBook } = require('../src/services/agentAddressBook.service');
const { AgentReportService: reports } = require('../src/services/agentReport.service');
const coreReports = require('../src/services/report.service');
const { rejectWithdrawal } = require('../src/services/withdrawal.service');
const { AgentService } = require('../src/ai/agent/agent.service');
const { AgentLoop } = require('../src/ai/agent/agent-loop.service');
const { ToolRegistry } = require('../src/ai/tools/tool-registry');
const { newSession } = require('../src/ai/agent/agent-state');
const { ActionGraphDispatcher } = require('../src/ai/runtime/action-graph-dispatcher');
const { randomUUID } = require('node:crypto');
const reportTools = require('../src/ai/tools/implementations/report.tools');
const { createWithdrawalTool } = require('../src/ai/tools/implementations/withdrawal.tools');
const addressTools = require('../src/ai/tools/implementations/address-book.tools');

// Database replica tạm riêng để kiểm tra khóa, rollback và đồng thời; không kết nối database dự án.
test('Luồng khách hàng mới với transaction MongoDB thật', { timeout: 180000 }, async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  try {
    await mongoose.connect(replica.getUri(), { dbName: 'handigo_agent_customer_flows_test' });
    await Promise.all([User, Wallet, BankAccount, WithdrawRequest, Address, Report, Order, Conversation].map(model => model.init()));
    const customer = await User.create({ email: 'customer@example.test', fullName: 'Nguyễn Văn An', role: 'CUSTOMER' });
    const other = await User.create({ email: 'other@example.test', fullName: 'Trần Văn Bình', role: 'CUSTOMER' });
    const admin = await User.create({ email: 'admin@example.test', fullName: 'Lê Văn Cường', role: 'ADMIN' });
    const user = { id: String(customer._id), role: 'CUSTOMER' }, otherUser = { id: String(other._id), role: 'CUSTOMER' };
    const bank = await BankAccount.create({ userId: customer._id, bankName: 'Ngân hàng thử nghiệm', bankCode: 'TEST', accountNumber: '123456789', accountHolderName: 'NGUYEN VAN AN', isDefault: true });
    const otherBank = await BankAccount.create({ userId: other._id, bankName: 'Ngân hàng khác', bankCode: 'TEST', accountNumber: '987654321', accountHolderName: 'TRAN VAN BINH' });
    const wallet = await Wallet.create({ userId: customer._id, balance: 1000000 });
    const args = { amount: 100000, bankAccountId: String(bank._id) };

    await t.test('Rút tiền đồng thời cùng mã hành động chỉ có một yêu cầu và một lần trừ ví', async () => {
      const preview = await withdrawal.preview(user, args);
      assert.doesNotMatch(JSON.stringify(preview), /123456789/);
      const outcomes = await Promise.allSettled([1, 2].map(() => withdrawal.create(user, args, 'session', 'same-action', preview)));
      assert.ok(outcomes.some(x => x.status === 'fulfilled'));
      assert.equal(outcomes.filter(x => x.status === 'rejected').length, 0);
      assert.equal(await WithdrawRequest.countDocuments({ userId: user.id }), 1);
      const current = await Wallet.findById(wallet._id);
      assert.equal(current.balance, 900000); assert.equal(current.pendingBalance, 100000);
      assert.equal((await withdrawal.reconcile(user, args, 'session', 'same-action')).status, 'pending');
      const replay = await withdrawal.create(user, args, 'session', 'same-action', preview);
      assert.equal(replay.status, 'pending'); assert.equal((await Wallet.findById(wallet._id)).balance, 900000);
    });

    await t.test('Hai yêu cầu khác nhau không thể cùng rút vượt số dư; ngân hàng người khác bị từ chối', async () => {
      const large = { ...args, amount: 700000 };
      const preview = await withdrawal.preview(user, large);
      const outcomes = await Promise.allSettled(['large-a', 'large-b'].map(id => withdrawal.create(user, large, 'session', id, preview)));
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      const current = await Wallet.findById(wallet._id);
      assert.equal(current.balance, 200000); assert.equal(current.pendingBalance, 800000);
      await assert.rejects(withdrawal.preview(user, { ...args, bankAccountId: String(otherBank._id) }));
      const own = await WithdrawRequest.findOne({ userId: user.id });
      await assert.rejects(withdrawal.detail(otherUser, String(own._id)), /Không tìm thấy/);
    });

    await t.test('Ngân hàng thay đổi sau xác nhận không tạo yêu cầu; từ chối rút trả lại số dư đúng một lần', async () => {
      const preview = await withdrawal.preview(user, args);
      await BankAccount.updateOne({ _id: bank._id }, { $set: { accountHolderName: 'NGUOI NHAN MOI' } }, { runValidators: true });
      await assert.rejects(withdrawal.create(user, args, 'session', 'changed-bank', preview), /thay đổi/);
      assert.equal(await WithdrawRequest.countDocuments({ userId: user.id }), 2);
      const record = await WithdrawRequest.findOne({ userId: user.id, amount: 100000 });
      await rejectWithdrawal({ id: String(admin._id), role: 'ADMIN' }, String(record._id), { adminNote: 'Ghi chú người xử lý' });
      const current = await Wallet.findById(wallet._id);
      assert.equal(current.balance, 300000); assert.equal(current.pendingBalance, 700000);
      assert.equal((await withdrawal.detail(user, String(record._id))).status, 'rejected');
      assert.doesNotMatch(JSON.stringify(await withdrawal.list(user, { page: 1, limit: 10 })), /admin@example|Ghi chú người xử lý|123456789/);
      await assert.rejects(rejectWithdrawal({ id: String(admin._id), role: 'ADMIN' }, String(record._id), {}));
      assert.equal((await Wallet.findById(wallet._id)).balance, 300000);
    });

    await t.test('Lỗi lưu yêu cầu rút rollback cả số dư khả dụng và số dư chờ trên MongoDB thật', async st => {
      const before = await Wallet.findById(wallet._id).lean(), count = await WithdrawRequest.countDocuments({ userId: user.id });
      const preview = await withdrawal.preview(user, args);
      st.mock.method(WithdrawRequest, 'create', async () => { throw new Error('Lỗi lưu sau cập nhật ví'); });
      await assert.rejects(withdrawal.create(user, args, 'session', 'rollback-withdrawal', preview), /Lỗi lưu/);
      const after = await Wallet.findById(wallet._id).lean();
      assert.equal(after.balance, before.balance); assert.equal(after.pendingBalance, before.pendingBalance);
      assert.equal(await WithdrawRequest.countDocuments({ userId: user.id }), count);
      assert.equal(await withdrawal.reconcile(user, args, 'session', 'rollback-withdrawal'), null);
    });

    await t.test('Xóa địa chỉ kiểm tra phiên bản trong transaction và chặn địa chỉ người khác', async () => {
      const address = await Address.create({ userId: customer._id, fullAddress: '12 Lê Lợi', ward: 'Phường A', province: 'Đà Nẵng', isDefault: true });
      const id = String(address._id), preview = await addressBook.preview(user.id, id, true);
      await Address.updateOne({ _id: id }, { $set: { fullAddress: 'Địa chỉ đã đổi', updatedAt: new Date(Date.now() + 1000) } }, { timestamps: false });
      await assert.rejects(addressBook.apply(user.id, id, true, preview), /thay đổi/);
      assert.equal((await Address.findById(id)).isDeleted, false);
      await assert.rejects(addressBook.preview(otherUser.id, id, true), /thuộc tài khoản/);
      const fresh = await addressBook.preview(user.id, id, true), start = new Date(Date.now() - 1000).toISOString();
      await addressBook.apply(user.id, id, true, fresh);
      assert.equal((await Address.findById(id)).isDeleted, true);
      assert.ok(await addressBook.reconcile(user.id, id, true, start));
      await assert.rejects(addressBook.preview(user.id, id, true), /thuộc tài khoản/);
    });

    await t.test('Đổi mặc định đồng thời giữ duy nhất một mục và không đổi địa chỉ bản nháp', async () => {
      const [a, b] = await Address.create([
        { userId: customer._id, fullAddress: 'Nhà A', ward: 'Phường A', province: 'Đà Nẵng' },
        { userId: customer._id, fullAddress: 'Nhà B', ward: 'Phường A', province: 'Đà Nẵng' },
      ]);
      const session = { bookingDraft: { status: 'paused', values: { addressId: String(a._id) } } };
      const pa = await addressBook.preview(user.id, String(a._id), false), pb = await addressBook.preview(user.id, String(b._id), false);
      await Promise.allSettled([[a, pa], [b, pb]].map(([address, preview]) => addressBook.apply(user.id, String(address._id), false, preview, session)));
      assert.equal(await Address.countDocuments({ userId: user.id, isDefault: true, isDeleted: false }), 1);
      assert.equal(session.bookingDraft.values.addressId, String(a._id));
      await assert.rejects(addressBook.preview(user.id, String(a._id), true, session), /đang dùng trong bản nháp/);
    });

    await t.test('Báo cáo ứng dụng, bổ sung bằng chứng, hủy và quyền sở hữu dùng nghiệp vụ thật', async () => {
      const args = { targetType: 'app', reportType: 'system_bug', title: 'Lỗi ứng dụng khi xem đơn', description: 'Ứng dụng hiển thị lỗi khi tôi mở danh sách đơn.', customerAttachments: [] };
      const preview = await reports.preview(user.id, args); assert.equal(preview.orderCode, 'Không gắn với đơn dịch vụ');
      const result = await reports.create(user.id, args, 'session', 'report-action');
      assert.equal(result.status, 'pending'); assert.equal(result.reportType, 'system_bug');
      assert.equal((await reports.reconcileCreated(user.id, 'session', 'report-action')).id, result.id);
      await assert.rejects(reports.detail(otherUser.id, result.id), /Không tìm thấy/);
      const image = 'https://res.cloudinary.com/demo/image/upload/v1/handigo/order-attachments/evidence.png';
      const start = new Date(Date.now() - 1000).toISOString();
      await reports.evidence(user.id, result.id, [image], 'Ảnh lỗi ứng dụng');
      assert.ok(await reports.reconcileEvidence(user.id, result.id, [image], 'Ảnh lỗi ứng dụng', start));
      await Report.updateOne({ _id: result.id }, { $set: { handledBy: admin._id, resolutionNote: 'Đang xem xét', requestedEvidenceNote: 'Cần ảnh rõ hơn' } });
      assert.doesNotMatch(JSON.stringify(await reports.detail(user.id, result.id)), /admin@example|handledBy|reviewedBy|createdViolationId/);
      await reports.previewAction(user.id, result.id); await reports.cancel(user.id, result.id);
      assert.equal((await reports.detail(user.id, result.id)).status, 'cancelled');
      await assert.rejects(reports.previewAction(user.id, result.id, [image]), /đã kết thúc/);
      await assert.rejects(reports.evidence(user.id, result.id, [image]), /đã kết thúc/);
    });

    await t.test('Báo cáo hành vi trên đơn chưa hoàn thành và chat không được vượt ownership qua hồ sơ thợ cũ', async () => {
      const ownOrder = new mongoose.Types.ObjectId(), foreignOrder = new mongoose.Types.ObjectId();
      await Order.collection.insertMany([
        { _id: ownOrder, customerId: customer._id, status: 'created', isDeleted: false, orderCode: 'ORD-OWN',
          orderType: 'normal', paymentMethod: 'cash', paymentStatus: 'unpaid', pricing: { bookingAmount: 100000, totalPaidAmount: 0 } },
        { _id: foreignOrder, customerId: other._id, status: 'accepted', isDeleted: false, orderCode: 'ORD-OTHER' },
      ]);
      const args = { targetType: 'order', orderId: String(ownOrder), reportType: 'harassment', title: 'Báo cáo hành vi quấy rối', description: 'Tôi gặp hành vi làm phiền cần được xem xét.' };
      assert.ok(await coreReports.resolveReportTarget(user.id, 'CUSTOMER', args));
      assert.equal((await reports.preview(user.id, args)).orderCode, 'ORD-OWN');
      const created = await reports.create(user.id, args, 'session', 'report-own-order');
      assert.equal(created.reportType, 'harassment'); assert.equal(created.status, 'pending');
      await assert.rejects(reports.preview(user.id, { ...args, orderId: String(foreignOrder) }), /không có quyền/);
      const chat = await Conversation.create({ orderId: foreignOrder, customerId: other._id, providerId: new mongoose.Types.ObjectId() });
      await assert.rejects(reports.preview(user.id, { ...args, targetType: 'chat_conversation', orderId: undefined, conversationId: String(chat._id) }));
    });

    await t.test('Báo cáo đã ghi nhưng mất phản hồi được đối soát bằng đúng mã hành động, không tạo lại', async st => {
      const original = coreReports.createReport;
      st.mock.method(coreReports, 'createReport', async (...args) => { await original(...args); throw new Error('Mất phản hồi sau ghi'); });
      const args = { targetType: 'app', reportType: 'system_bug', title: 'Lỗi cần đối soát', description: 'Mô tả lỗi ứng dụng cần được kiểm tra.' };
      const before = await Report.countDocuments({ reporterId: user.id });
      await assert.rejects(reports.create(user.id, args, 'session', 'lost-report'), /Mất phản hồi/);
      assert.equal(await Report.countDocuments({ reporterId: user.id }), before + 1);
      assert.equal((await reports.reconcileCreated(user.id, 'session', 'lost-report')).status, 'pending');
      assert.equal(await Report.countDocuments({ reporterId: user.id }), before + 1);
    });

    await t.test('Hội thoại qua agent thật: chọn nhóm → xem trước → từ chối/hết hạn/xác nhận → chống lặp request', async () => {
      const image = 'https://res.cloudinary.com/demo/image/upload/v1/handigo/order-attachments/flow.png';
      for (const name of ['create_report', 'add_report_evidence', 'cancel_report', 'create_withdrawal', 'delete_saved_address', 'set_default_address']) {
        for (const decision of ['REJECT', 'EXPIRED', 'CONFIRM']) {
          let args, currentState, tool, intent;
          if (name === 'create_withdrawal') {
            args = { amount: 10000, bankAccountId: String(bank._id) }; tool = createWithdrawalTool; intent = 'payment';
            currentState = async () => (await Wallet.findById(wallet._id)).balance;
          } else if (name.includes('address')) {
            const address = await Address.create({ userId: user.id, fullAddress: `Địa chỉ thử ${randomUUID()}`, ward: 'Phường A', province: 'Đà Nẵng' });
            args = { addressId: String(address._id) }; intent = 'booking';
            tool = name === 'delete_saved_address' ? addressTools.deleteSavedAddressTool : addressTools.setDefaultAddressTool;
            currentState = async () => { const item = await Address.findById(address._id); return name === 'delete_saved_address' ? item.isDeleted : item.isDefault; };
          } else {
            intent = 'complaint';
            if (name === 'create_report') {
              args = { targetType: 'app', reportType: 'system_bug', title: 'Lỗi trong cuộc trò chuyện', description: 'Mô tả lỗi cần được xem xét trong hệ thống.', customerAttachments: [image] };
              tool = reportTools.createReportTool; currentState = () => Report.countDocuments({ reporterId: user.id });
            } else {
              const report = await Report.create({ reporterId: user.id, reporterRole: 'CUSTOMER', targetType: 'app', reportType: 'system_bug', title: 'Lỗi cần xem xét', description: 'Mô tả lỗi ứng dụng cần được xử lý.' });
              args = { reportId: String(report._id), ...(name === 'add_report_evidence' ? { customerAttachments: [image] } : {}) };
              tool = name === 'add_report_evidence' ? reportTools.addReportEvidenceTool : reportTools.cancelReportTool;
              currentState = async () => { const item = await Report.findById(report._id); return name === 'add_report_evidence' ? item.evidenceFiles.length : item.status; };
            }
          }
          const before = await currentState(), session = newSession(randomUUID(), user.id);
          session.uploadedAttachments = [image];
          const queue = [{ type: 'TOOL_CALL', tool: 'select_tool_group', arguments: { intent } }, { type: 'TOOL_CALL', tool: name, arguments: args }];
          const provider = { generate: async () => { assert.ok(queue.length, `${name}: không gọi model thêm sau kết quả`); return queue.shift(); } };
          const registry = new ToolRegistry({}, true).register(tool), records = new Map();
          const ledger = { find: async key => records.get(key.id) ?? null,
            reserve: async key => { const inserted = !records.has(key.id); if (inserted) records.set(key.id, { ...key, status: 'EXECUTING', startedAt: new Date().toISOString() }); return { inserted, record: records.get(key.id) }; },
            settle: async (key, status, result) => { const record = { ...records.get(key.id), status, result }; records.set(key.id, record); return record; } };
          const dispatcher = new ActionGraphDispatcher(registry, ledger, async () => {});
          const loop = new AgentLoop(provider, registry, { maxIterations: 5, systemPrompt: 'Trợ lý thử nghiệm', timeoutMs: 5000 }, dispatcher);
          const agent = new AgentService({ acquire: async () => ({ session, lockId: 'lock' }), save: async () => {}, release: async () => {} }, loop);
          const prepared = await agent.send(user, session.id, { requestId: randomUUID(), message: 'Giúp tôi xử lý yêu cầu này.', ...(args.customerAttachments ? { customerAttachments: [image] } : {}) });
          assert.equal(prepared.pendingConfirmation?.tool, name, `${name}/${decision}`);
          assert.equal(await currentState(), before, `${name}: chuẩn bị không ghi`);
          const originalId = prepared.pendingConfirmation.actionId;
          if (decision === 'EXPIRED') session.pendingAction.expiresAt = '2000-01-01T00:00:00Z';
          const request = { requestId: randomUUID(), confirmation: { actionId: originalId, decision: decision === 'REJECT' ? 'REJECT' : 'CONFIRM' } };
          const result = await agent.send(user, session.id, request);
          if (decision === 'CONFIRM') {
            assert.notEqual(await currentState(), before, name);
            const after = await currentState();
            await agent.send(user, session.id, request); assert.equal(await currentState(), after, `${name}: không ghi lặp request`);
            assert.equal(result.requiresReconciliation, false, name);
          } else {
            assert.equal(await currentState(), before, `${name}: ${decision} không ghi`);
            if (decision === 'EXPIRED') assert.notEqual(result.pendingConfirmation?.actionId, originalId, name);
          }
        }
      }
    });
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
