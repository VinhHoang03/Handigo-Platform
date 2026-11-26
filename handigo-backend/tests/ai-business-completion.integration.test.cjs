const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
const links = new Map();
let gatewayCalls = 0;
const payos = { paymentRequests: {
  create: async input => {
    gatewayCalls++;
    const link = { id: `link-${input.orderCode}`, paymentLinkId: `link-${input.orderCode}`, orderCode: input.orderCode,
      amount: input.amount, amountPaid: 0, status: 'PENDING', checkoutUrl: 'https://pay.payos.vn/test', qrCode: 'ma-qr-gia-lap' };
    links.set(input.orderCode, link); return { ...link };
  },
  get: async code => { gatewayCalls++; const link = links.get(code); if (!link) throw Error('Không tìm thấy QR giả lập'); return { ...link }; },
  cancel: async code => { gatewayCalls++; links.get(code).status = 'CANCELLED'; },
} };
// Chỉ gateway ngoài hệ thống được giả lập; các query, transaction và ghi ví chạy thật.
require.cache[require.resolve('../src/configs/payos.config.ts')] = { exports: { payos } };
const { MongoMemoryReplSet } = require(path.join(process.env.AGENT_CUSTOMER_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-agent-customer-test-runtime'), 'node_modules/mongodb-memory-server'));
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Order } = require('../src/models/order.model');
const { Provider } = require('../src/models/provider.model');
const { Wallet } = require('../src/models/wallet.model');
const { Payment } = require('../src/models/payment.model');
const { RepairQuotation } = require('../src/models/repairQuotation.model');
const { WalletTransaction } = require('../src/models/walletTransaction.model');
const { AgentPaymentService: payments } = require('../src/services/agentPayment.service');
const { AgentUnpaidOrderService: unpaid } = require('../src/services/agentUnpaidOrder.service');
const { AgentFeedbackService: feedback } = require('../src/services/agentFeedback.service');
const { FeedbackModeration } = require('../src/models/feedbackModeration.model');
const { AgentService } = require('../src/ai/agent/agent.service');
const { AgentLoop } = require('../src/ai/agent/agent-loop.service');
const { ToolRegistry } = require('../src/ai/tools/tool-registry');
const { newSession } = require('../src/ai/agent/agent-state');
const { ActionGraphDispatcher } = require('../src/ai/runtime/action-graph-dispatcher');
const { createPaymentTool } = require('../src/ai/tools/implementations/payment.tools');
const { discardUnpaidOrderTool } = require('../src/ai/tools/implementations/discard-unpaid-order.tool');
const { randomUUID } = require('node:crypto');
let sequence = 0;

test('Hoàn thiện nghiệp vụ AI với MongoDB replica cô lập và gateway giả lập', { timeout: 180000 }, async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  try {
    await mongoose.connect(replica.getUri(), { dbName: 'handigo_ai_business_completion_test' });
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    async function fixture(completed = true) {
      const n = ++sequence;
      const customer = await User.create({ fullName: 'Khách thử nghiệm', email: `customer-${n}@example.test`, role: 'CUSTOMER' });
      const worker = await User.create({ fullName: 'Thợ thử nghiệm', email: `worker-${n}@example.test`, role: 'PROVIDER' });
      const provider = await Provider.create({ userId: worker._id, verified: true, description: 'Thợ sửa chữa', experienceYears: 3, serviceIds: [] });
      await Wallet.create({ userId: customer._id, balance: 2000000 });
      await Wallet.create({ userId: worker._id, balance: 0 });
      const order = await Order.create({ orderCode: `ORD-AI-${n}`, customerId: customer._id, providerId: completed ? provider._id : null,
        serviceId: new mongoose.Types.ObjectId(), addressId: new mongoose.Types.ObjectId(), orderType: 'normal',
        status: completed ? 'completed' : 'created', paymentStatus: completed ? 'partially_paid' : 'unpaid', paymentMethod: 'bank',
        inspectionRequired: completed, depositAmount: 100000, depositPaidAt: completed ? new Date() : null, readyForMatching: false,
        pricing: { baseAmount: 100000, bookingAmount: 100000, totalPaidAmount: 100000, platformCommissionRate: 0,
          platformCommissionAmount: 0, providerEarningAmount: 0 } });
      const quotation = completed ? await RepairQuotation.create({ quotationCode: `Q-AI-${n}`, orderId: order._id, customerId: customer._id,
        providerId: provider._id, status: 'saved', revision: 1, subtotalAmount: 1000000, finalAmount: 1000000 }) : null;
      if (quotation) {
        await Order.updateOne({ _id: order._id }, { $set: { currentQuotationId: quotation._id } }, { runValidators: true });
        await Payment.create({ orderId: order._id, customerId: customer._id, method: 'payos', paymentType: 'inspection_deposit',
          amount: 100000, status: 'paid', paidAt: new Date(), transactionCode: `DEPOSIT-${n}` });
      }
      return { customer, worker, provider, order, quotation, user: { id: String(customer._id), role: 'CUSTOMER' }, orderId: String(order._id) };
    }
    await t.test('Thanh toán ví đồng thời chỉ thu và ghi thu nhập thợ một lần', async () => {
      const f = await fixture(), args = { orderId: f.orderId, method: 'WALLET' };
      const preview = await payments.preview(f.user, args);
      assert.equal(preview.amount, 900000); assert.equal(preview.quotationRevision, 1);
      const results = await Promise.allSettled([1, 2].map(() => payments.pay(f.user, args, preview)));
      assert.ok(results.some(x => x.status === 'fulfilled' && x.value.status === 'paid'));
      assert.equal((await Wallet.findOne({ userId: f.customer._id })).balance, 1100000);
      assert.equal((await Wallet.findOne({ userId: f.worker._id })).balance, 900000);
      assert.equal(await Payment.countDocuments({ orderId: f.order._id, paymentType: 'remaining', status: 'paid' }), 1);
      assert.equal(await WalletTransaction.countDocuments({ relatedOrderId: f.order._id, type: 'provider_earning' }), 1);
      assert.equal((await payments.status(f.user, f.orderId)).status, 'paid');
      await assert.rejects(payments.preview(f.user, args));
    });
    await t.test('Thiếu ví, sai chủ đơn, chưa hoàn thành, đã trả trực tiếp và phiên bản đổi đều không thu tiền', async () => {
      const f = await fixture(), args = { orderId: f.orderId, method: 'WALLET' };
      const preview = await payments.preview(f.user, args);
      await assert.rejects(payments.preview({ id: String(f.worker._id), role: 'CUSTOMER' }, args));
      await assert.rejects(payments.preview({ ...f.user, role: 'PROVIDER' }, args));
      await assert.rejects(payments.preview(f.user, { ...args, method: 'CASH' }));
      await Wallet.updateOne({ userId: f.customer._id }, { $set: { balance: 10000 } });
      await assert.rejects(payments.preview(f.user, args));
      await Wallet.updateOne({ userId: f.customer._id }, { $set: { balance: 2000000 } });
      await RepairQuotation.updateOne({ _id: f.quotation._id }, { $inc: { revision: 1 } });
      assert.equal((await payments.pay(f.user, args, preview)).status, 'blocked');
      await Order.updateOne({ _id: f.order._id }, { $set: { status: 'in_progress' } });
      await assert.rejects(payments.preview(f.user, args));
      await Order.updateOne({ _id: f.order._id }, { $set: { status: 'completed', paymentStatus: 'paid' } });
      await RepairQuotation.updateOne({ _id: f.quotation._id }, { $set: { directPaymentConfirmedAt: new Date(), directPaymentConfirmedAmount: 900000 } });
      await assert.rejects(payments.preview(f.user, args));
      assert.equal(await Payment.countDocuments({ orderId: f.order._id, paymentType: 'remaining' }), 0);
      assert.equal((await Wallet.findOne({ userId: f.customer._id })).balance, 2000000);
    });
    await t.test('QR báo giá có thể đối soát và hủy riêng, không hủy đơn hoặc tạo khoản thu khác', async () => {
      const f = await fixture(), args = { orderId: f.orderId, method: 'PAYOS' };
      const preview = await payments.preview(f.user, args);
      const created = await payments.pay(f.user, args, preview);
      assert.equal(created.status, 'pending'); assert.equal(created.paymentType, 'remaining');
      const cancel = await payments.previewCancellation(f.user, f.orderId, created.paymentId);
      const result = await payments.cancel(f.user, f.orderId, cancel, 'cancel-qr');
      assert.equal(result.status, 'failed'); assert.equal((await Order.findById(f.order._id)).status, 'completed');
      assert.equal((await Order.findById(f.order._id)).paymentStatus, 'partially_paid');
      assert.equal((await Wallet.findOne({ userId: f.customer._id })).balance, 2000000);
      assert.equal((await payments.cancel(f.user, f.orderId, cancel, 'cancel-qr')).status, 'failed');
    });
    await t.test('Đổi QR báo giá sang ví chỉ sau đối soát; QR đang xử lý không tạo thêm giao dịch', async () => {
      const f = await fixture(), args = { orderId: f.orderId, method: 'PAYOS' };
      await payments.pay(f.user, args, await payments.preview(f.user, args));
      const qr = await Payment.findOne({ orderId: f.order._id, paymentType: 'remaining' });
      const walletArgs = { ...args, method: 'WALLET' }, preview = await payments.preview(f.user, walletArgs);
      links.get(Number(qr.gatewayOrderCode)).status = 'PROCESSING';
      assert.equal((await payments.pay(f.user, walletArgs, preview)).status, 'blocked');
      assert.equal(await Payment.countDocuments({ orderId: f.order._id, paymentType: 'remaining' }), 1);
      links.get(Number(qr.gatewayOrderCode)).status = 'PENDING';
      assert.equal((await payments.pay(f.user, walletArgs, preview)).status, 'paid');
      assert.equal((await Payment.findById(qr._id)).status, 'failed');
      assert.equal((await Wallet.findOne({ userId: f.customer._id })).balance, 1100000);
    });
    await t.test('Xóa đơn chưa trả tiền đóng QR trước, đối soát được sau mất phản hồi và không xóa đơn người khác', async () => {
      const f = await fixture(false);
      const link = await payos.paymentRequests.create({ orderCode: 100001, amount: 100000 });
      const qr = await Payment.create({ orderId: f.order._id, customerId: f.customer._id, amount: 100000, paymentType: 'full',
        method: 'payos', status: 'pending', transactionCode: 'UNPAID-QR', gatewayOrderCode: '100001', gatewayPaymentLinkId: link.id });
      await assert.rejects(unpaid.preview(String(f.worker._id), f.orderId));
      const preview = await unpaid.preview(f.user.id, f.orderId), startedAt = new Date(Date.now() - 1000).toISOString();
      await unpaid.discard(f.user.id, f.orderId, preview);
      assert.equal((await Order.findById(f.order._id)).isDeleted, true);
      assert.equal((await Payment.findById(qr._id)).status, 'failed');
      assert.ok(await unpaid.reconcile(f.user.id, f.orderId, startedAt));
      assert.equal(await unpaid.reconcile(String(f.worker._id), f.orderId, startedAt), null);
    });
    await t.test('Xóa đơn chặn phiên bản đổi, QR chưa đối soát được và đơn vừa thanh toán', async () => {
      const f = await fixture(false), preview = await unpaid.preview(f.user.id, f.orderId);
      await Order.updateOne({ _id: f.order._id }, { $set: { paymentMethod: 'wallet' } });
      const before = gatewayCalls;
      await assert.rejects(unpaid.discard(f.user.id, f.orderId, preview)); assert.equal(gatewayCalls, before);
      const fresh = await unpaid.preview(f.user.id, f.orderId);
      await Payment.create({ orderId: f.order._id, customerId: f.customer._id, amount: 100000, paymentType: 'full', method: 'payos',
        status: 'pending', transactionCode: 'UNKNOWN-QR', gatewayOrderCode: '999999' });
      await assert.rejects(unpaid.discard(f.user.id, f.orderId, fresh));
      assert.equal((await Order.findById(f.order._id)).isDeleted, false);
      await Order.updateOne({ _id: f.order._id }, { $set: { paymentStatus: 'paid' } });
      await assert.rejects(unpaid.preview(f.user.id, f.orderId));
    });
    await t.test('Tra kiểm duyệt chỉ trả bản của chính khách, kể cả nội dung bị chặn chưa có đánh giá', async () => {
      const f = await fixture();
      await FeedbackModeration.create({ userId: f.customer._id, resourceId: f.order._id, kind: 'comment', contentHash: 'test-hash',
        content: 'Nội dung cần kiểm tra', status: 'pending', decision: 'review', source: 'ai', reason: 'Nội dung nội bộ không được đưa vào agent' });
      await FeedbackModeration.create({ userId: f.worker._id, resourceId: f.order._id, kind: 'reply', contentHash: 'other-hash',
        content: 'Phản hồi riêng của thợ', status: 'rejected', decision: 'block', source: 'ai', reason: 'Ghi chú nội bộ' });
      const result = await feedback.moderation(f.user.id, f.orderId);
      assert.equal(result.items.length, 1); assert.equal(result.items[0].isCurrent, false);
      assert.doesNotMatch(JSON.stringify(result), /Phản hồi riêng|Nội dung nội bộ|reviewedBy/);
      await assert.rejects(feedback.moderation(String(f.worker._id), f.orderId));
    });
    await t.test('Agent thật nối xem trước, từ chối, hết hạn, xác nhận và chống lặp cho thanh toán báo giá và xóa đơn', async () => {
      for (const tool of [createPaymentTool, discardUnpaidOrderTool]) for (const decision of ['REJECT', 'EXPIRED', 'CONFIRM']) {
        const paying = tool.name === 'create_payment', f = await fixture(paying);
        const args = { orderId: f.orderId, ...(paying ? { method: 'WALLET' } : {}) };
        const current = async () => paying ? (await Wallet.findOne({ userId: f.customer._id })).balance : (await Order.findById(f.order._id)).isDeleted;
        const before = await current(), session = newSession(randomUUID(), f.user.id);
        const queue = [{ type: 'TOOL_CALL', tool: 'select_tool_group', arguments: { intent: paying ? 'payment' : 'order' } },
          { type: 'TOOL_CALL', tool: tool.name, arguments: args }];
        const provider = { generate: async () => { assert.ok(queue.length, 'Không gọi model để lặp thao tác đã hoàn thành'); return queue.shift(); } };
        const registry = new ToolRegistry({}, true).register(tool), records = new Map();
        const ledger = { find: async key => records.get(key.id) ?? null,
          reserve: async key => { const inserted = !records.has(key.id); if (inserted) records.set(key.id, { ...key, status: 'EXECUTING', startedAt: new Date().toISOString() }); return { inserted, record: records.get(key.id) }; },
          settle: async (key, status, result) => { const record = { ...records.get(key.id), status, result }; records.set(key.id, record); return record; } };
        const dispatcher = new ActionGraphDispatcher(registry, ledger, async () => {});
        const loop = new AgentLoop(provider, registry, { maxIterations: 5, systemPrompt: 'Trợ lý thử nghiệm', timeoutMs: 5000 }, dispatcher);
        const agent = new AgentService({ acquire: async () => ({ session, lockId: 'lock' }), save: async () => {}, release: async () => {} }, loop);
        const prepared = await agent.send(f.user, session.id, { requestId: randomUUID(), message: 'Giúp tôi xử lý yêu cầu này.' });
        assert.equal(prepared.pendingConfirmation?.tool, tool.name); assert.equal(await current(), before);
        const actionId = prepared.pendingConfirmation.actionId;
        if (decision === 'EXPIRED') session.pendingAction.expiresAt = '2000-01-01T00:00:00Z';
        const request = { requestId: randomUUID(), confirmation: { actionId, decision: decision === 'REJECT' ? 'REJECT' : 'CONFIRM' } };
        const result = await agent.send(f.user, session.id, request);
        if (decision === 'CONFIRM') {
          const after = await current(); assert.notEqual(after, before);
          await agent.send(f.user, session.id, request); assert.equal(await current(), after);
          assert.equal(result.requiresReconciliation, false);
        } else {
          assert.equal(await current(), before);
          if (decision === 'EXPIRED') assert.notEqual(result.pendingConfirmation?.actionId, actionId);
        }
      }
    });
  } finally { await mongoose.disconnect(); await replica.stop(); }
});
