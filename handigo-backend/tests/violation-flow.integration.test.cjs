const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
const { MongoMemoryReplSet } = require(path.join(process.env.ADMIN_AI_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-admin-ai-test-runtime'), 'node_modules/mongodb-memory-server'));
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Report } = require('../src/models/report.model');
const { Session } = require('../src/models/session.model');
const { Violation } = require('../src/models/violation.model');
const { ViolationEmail } = require('../src/models/violationEmail.model');
const { SupportTicket } = require('../src/models/supportTicket.model');
require('../src/models/complaint.model');
require('../src/models/order.model');
const { createViolation } = require('../src/services/violation.service');
const { updateUserStatus } = require('../src/services/admin.service');
const { refreshTemporaryLock, assertFeatureAllowed } = require('../src/services/penaltyPolicy.service');
const { processViolationEmails } = require('../src/services/violationEmail.service');
const mail = require('../src/utils/mail');

test('Luồng vi phạm và email với transaction MongoDB thật', { timeout: 120000 }, async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  try {
    await mongoose.connect(replica.getUri(), { dbName: 'handigo_violation_flow_test' });
    await Promise.all([User, Report, Session, Violation, ViolationEmail, SupportTicket].map(model => model.init()));
    let sequence = 0;
    async function fixture(type = 'WARNING') {
      const id = ++sequence;
      const admin = await User.create({ email: `admin${id}@example.test`, fullName: 'Nguyễn Văn An', role: 'ADMIN' });
      const user = await User.create({ email: `khach${id}@example.test`, fullName: 'Trần Văn Bình' });
      const report = await Report.create({ reporterId: admin._id, targetType: 'user', targetUserId: user._id,
        reportType: 'spam_chat', title: 'Báo cáo tin rác', description: 'Gửi tin nhắn làm phiền nhiều lần' });
      const session = await Session.create({ userId: user._id, refreshTokenHash: 'gia-lap', expiresAt: new Date(Date.now() + 86400000) });
      const payload = { sourceType: 'REPORT', sourceId: String(report._id), violationType: 'Gửi tin nhắn rác',
        severity: 'HIGH', reason: 'Đã xác minh tin nhắn làm phiền', adminDecision: 'Xử lý theo quy định Handigo',
        penalty: { type, ...(type === 'TEMPORARY_SUSPEND' ? { durationDays: 1 } : {}) } };
      return { admin, user, report, session, payload };
    }

    for (const type of ['WARNING', 'TEMPORARY_SUSPEND', 'PERMANENT_BAN']) {
      await t.test(`Quyết định ${type} lưu đúng người nhận, trạng thái và phiên đăng nhập`, async st => {
        const f = await fixture(type);
        const send = st.mock.method(mail, 'sendNotificationEmail', async () => {});
        const result = await createViolation(String(f.admin._id), f.payload);
        const queued = await ViolationEmail.findOne({ violationId: result._id });
        assert.equal(queued.to, f.user.email);
        assert.equal(queued.status, 'pending');
        assert.ok(queued.text.includes(f.payload.adminDecision));
        assert.ok(queued.text.includes(String(result._id)));
        assert.equal(send.mock.callCount(), 0);
        assert.equal(String((await Report.findById(f.report._id)).createdViolationId), String(result._id));
        const user = await User.findById(f.user._id).select('+temporaryLockId');
        assert.equal(user.status, type === 'WARNING' ? 'active' : 'locked');
        assert.equal(Boolean((await Session.findById(f.session._id)).revokedAt), type !== 'WARNING');
        assert.equal(Boolean(user.temporaryLockId), type === 'TEMPORARY_SUSPEND');
        await assert.rejects(createViolation(String(f.admin._id), f.payload), /đã có bản ghi vi phạm/);
        assert.equal(await ViolationEmail.countDocuments({ violationId: result._id }), 1);
      });
    }

    await t.test('Lỗi hàng đợi rollback cả vi phạm, nguồn và khóa tài khoản', async st => {
      const f = await fixture('TEMPORARY_SUSPEND');
      st.mock.method(ViolationEmail, 'create', async () => { throw new Error('Lỗi hàng đợi giả lập'); });
      await assert.rejects(createViolation(String(f.admin._id), f.payload), /Lỗi hàng đợi giả lập/);
      assert.equal(await Violation.countDocuments({ userId: f.user._id }), 0);
      assert.equal((await User.findById(f.user._id)).status, 'active');
      assert.equal((await Session.findById(f.session._id)).revokedAt, null);
      assert.equal((await Report.findById(f.report._id)).createdViolationId, null);
    });

    await t.test('Hai worker đồng thời chỉ nhận mỗi email một lần', async st => {
      const sent = [];
      st.mock.method(mail, 'sendNotificationEmail', async message => { sent.push(message.messageId); });
      const pending = await ViolationEmail.countDocuments({ status: 'pending' });
      await Promise.all([processViolationEmails(), processViolationEmails()]);
      assert.equal(sent.length, pending);
      assert.equal(new Set(sent).size, pending);
      assert.equal(await ViolationEmail.countDocuments({ status: 'sent' }), pending);
    });

    await t.test('Hết hạn tạm khóa tự mở và giữ phiên cũ bị thu hồi', async () => {
      const f = await fixture('TEMPORARY_SUSPEND');
      const result = await createViolation(String(f.admin._id), f.payload);
      await Violation.updateOne({ _id: result._id }, { endAt: new Date(Date.now() - 1000) }, { runValidators: true });
      await refreshTemporaryLock(f.user._id);
      const user = await User.findById(f.user._id).select('+temporaryLockId');
      assert.equal(user.status, 'active');
      assert.equal(user.temporaryLockId, undefined);
      assert.equal((await Violation.findById(result._id)).status, 'resolved');
      assert.ok((await Session.findById(f.session._id)).revokedAt);
    });

    await t.test('Khóa và mở thủ công không còn phụ thuộc biến decision', async () => {
      const f = await fixture();
      await updateUserStatus(String(f.admin._id), String(f.user._id), 'locked');
      assert.equal((await User.findById(f.user._id)).status, 'locked');
      assert.ok((await Session.findById(f.session._id)).revokedAt);
      await updateUserStatus(String(f.admin._id), String(f.user._id), 'active');
      assert.equal((await User.findById(f.user._id)).status, 'active');
      await assert.rejects(updateUserStatus(String(f.admin._id), String(f.admin._id), 'locked'), /không thể khóa tài khoản của chính mình/);
    });

    async function assertUnchanged(f) {
      assert.equal(await Violation.countDocuments({ userId: f.user._id }), 0);
      assert.equal(await ViolationEmail.countDocuments({ userId: f.user._id }), 0);
      assert.equal((await User.findById(f.user._id)).status, 'active');
      assert.equal((await Session.findById(f.session._id)).revokedAt, null);
      assert.equal((await Report.findById(f.report._id)).createdViolationId, null);
    }

    for (const status of ['cancelled', 'rejected']) {
      await t.test(`Nguồn ${status} trả 400 và không phát sinh quyết định/email`, async () => {
        const f = await fixture();
        await Report.updateOne({ _id: f.report._id }, { status }, { runValidators: true });
        await assert.rejects(createViolation(String(f.admin._id), f.payload), error => error.statusCode === 400);
        await assertUnchanged(f);
      });
    }

    for (const scenario of ['nguồn không tồn tại', 'nguồn đã xóa', 'người dùng không tồn tại', 'người dùng đã xóa', 'người dùng là ADMIN', 'thiếu người vi phạm', 'khách vắng mặt chưa xác nhận', 'tính năng không hỗ trợ']) {
      await t.test(`Từ chối khi ${scenario}, không lưu dữ liệu dở dang`, async () => {
        const f = await fixture();
        let expected = 400;
        if (scenario === 'nguồn không tồn tại') { f.payload.sourceId = String(new mongoose.Types.ObjectId()); expected = 404; }
        if (scenario === 'nguồn đã xóa') { await Report.updateOne({ _id: f.report._id }, { isDeleted: true }); expected = 404; }
        if (scenario === 'người dùng không tồn tại') { await Report.updateOne({ _id: f.report._id }, { targetUserId: new mongoose.Types.ObjectId() }); expected = 404; }
        if (scenario === 'người dùng đã xóa') { await User.updateOne({ _id: f.user._id }, { isDeleted: true }); expected = 404; }
        if (scenario === 'người dùng là ADMIN') await User.updateOne({ _id: f.user._id }, { role: 'ADMIN' });
        if (scenario === 'thiếu người vi phạm') await Report.updateOne({ _id: f.report._id }, { targetUserId: null });
        if (scenario === 'khách vắng mặt chưa xác nhận') { await Report.updateOne({ _id: f.report._id }, { isCustomerNoShow: true }); expected = 409; }
        if (scenario === 'tính năng không hỗ trợ') f.payload.penalty = { type: 'RESTRICT_FEATURE', feature: 'tinh-nang-khong-co' };
        await assert.rejects(createViolation(String(f.admin._id), f.payload), error => error.statusCode === expected);
        await assertUnchanged(f);
      });
    }

    for (const stage of ['thu hồi phiên', 'cập nhật nguồn']) {
      await t.test(`Lỗi ${stage} rollback cả tài khoản, vi phạm và email`, async st => {
        const f = await fixture('TEMPORARY_SUSPEND');
        st.mock.method(stage === 'thu hồi phiên' ? Session : Report,
          stage === 'thu hồi phiên' ? 'updateMany' : 'findByIdAndUpdate', async () => { throw new Error('Lỗi database giả lập'); });
        await assert.rejects(createViolation(String(f.admin._id), f.payload), /Lỗi database giả lập/);
        await assertUnchanged(f);
      });
    }

    for (const sourceType of ['REPORT', 'SUPPORT_TICKET']) {
      await t.test(`Hai admin xử lý đồng thời ${sourceType} chỉ tạo một vi phạm và một email`, async () => {
        const f = await fixture('TEMPORARY_SUSPEND');
        if (sourceType === 'SUPPORT_TICKET') {
          const ticket = await SupportTicket.create({ requesterId: f.user._id, category: 'SECURITY',
            subject: 'Yêu cầu kiểm tra vi phạm', description: 'Đề nghị kiểm tra nội dung tin nhắn' });
          f.payload = { ...f.payload, sourceType, sourceId: String(ticket._id), userId: String(f.user._id) };
        }
        const results = await Promise.allSettled([
          createViolation(String(f.admin._id), f.payload), createViolation(String(f.admin._id), f.payload),
        ]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const rejected = results.find(result => result.status === 'rejected');
        assert.equal(rejected.reason.statusCode, 400);
        assert.equal(await Violation.countDocuments({ userId: f.user._id }), 1);
        assert.equal(await ViolationEmail.countDocuments({ userId: f.user._id }), 1);
      });
    }

    await t.test('Khiếu nại dùng báo cáo chất lượng, nguồn không đúng loại trả 404', async () => {
      const f = await fixture();
      f.payload.sourceType = 'COMPLAINT';
      await assert.rejects(createViolation(String(f.admin._id), f.payload), error => error.statusCode === 404);
      await Report.updateOne({ _id: f.report._id }, { reportType: 'service_quality' }, { runValidators: true });
      const result = await createViolation(String(f.admin._id), f.payload);
      assert.equal(result.sourceType, 'REPORT');
      assert.equal(await ViolationEmail.countDocuments({ violationId: result._id }), 1);
    });

    for (const penalty of [
      { type: 'RESTRICT_FEATURE', feature: 'Trò chuyện' }, { type: 'RESTRICT_CHAT' },
      { type: 'RESTRICT_VOUCHER' }, { type: 'RESTRICT_ORDER_RECEIVING' },
    ]) {
      await t.test(`Hạn chế ${penalty.type} giữ đăng nhập, gửi thông báo và chặn đúng tính năng`, async () => {
        const f = await fixture();
        f.payload.penalty = penalty;
        await createViolation(String(f.admin._id), f.payload);
        assert.equal((await User.findById(f.user._id)).status, 'active');
        assert.equal((await Session.findById(f.session._id)).revokedAt, null);
        const feature = penalty.type === 'RESTRICT_VOUCHER' ? 'voucher'
          : penalty.type === 'RESTRICT_ORDER_RECEIVING' ? 'order_receiving' : 'chat';
        await assert.rejects(assertFeatureAllowed(f.user._id, feature), error => error.statusCode === 403);
        await assert.doesNotReject(assertFeatureAllowed(f.user._id, 'booking'));
        const queued = await ViolationEmail.findOne({ userId: f.user._id });
        assert.ok(!queued.text.includes('Bạn không thể đăng nhập'));
      });
    }

    await t.test('Thiếu email ở dữ liệu cũ vẫn áp dụng hình phạt, không tạo thư sai người nhận', async () => {
      const f = await fixture('TEMPORARY_SUSPEND');
      await User.collection.updateOne({ _id: f.user._id }, { $unset: { email: 1 } });
      await createViolation(String(f.admin._id), f.payload);
      assert.equal((await User.findById(f.user._id)).status, 'locked');
      assert.equal(await Violation.countDocuments({ userId: f.user._id }), 1);
      assert.equal(await ViolationEmail.countDocuments({ userId: f.user._id }), 0);
    });

    await t.test('Tạm khóa hết hạn không mở tài khoản còn quyết định khóa vĩnh viễn', async () => {
      const f = await fixture('TEMPORARY_SUSPEND');
      const temporary = await createViolation(String(f.admin._id), f.payload);
      await Violation.create({ userId: f.user._id, handledBy: f.admin._id, violationType: 'Vi phạm khác',
        severity: 'HIGH', penaltyType: 'PERMANENT_BAN', startAt: new Date() });
      await Violation.updateOne({ _id: temporary._id }, { endAt: new Date(Date.now() - 1000) }, { runValidators: true });
      await refreshTemporaryLock(f.user._id);
      assert.equal((await User.findById(f.user._id)).status, 'locked');
    });

    await t.test('Mở khóa thủ công giải quyết các hình phạt khóa, giữ hạn chế tính năng khác', async () => {
      const f = await fixture('TEMPORARY_SUSPEND');
      const temporary = await createViolation(String(f.admin._id), f.payload);
      const chat = await Violation.create({ userId: f.user._id, handledBy: f.admin._id, violationType: 'Spam trò chuyện',
        severity: 'HIGH', penaltyType: 'RESTRICT_CHAT', startAt: new Date() });
      await updateUserStatus(String(f.admin._id), String(f.user._id), 'active');
      assert.equal((await Violation.findById(temporary._id)).status, 'resolved');
      assert.equal((await Violation.findById(chat._id)).status, 'active');
      await assert.rejects(assertFeatureAllowed(f.user._id, 'chat'), error => error.statusCode === 403);
    });

    for (const status of ['cancelled', 'closed', 'resolved']) {
      await t.test(`Yêu cầu hỗ trợ ${status} không thể tạo vi phạm`, async () => {
        const f = await fixture();
        const ticket = await SupportTicket.create({ requesterId: f.user._id, category: 'SECURITY', status,
          subject: 'Yêu cầu kiểm tra vi phạm', description: 'Đề nghị kiểm tra nội dung tin nhắn' });
        await assert.rejects(createViolation(String(f.admin._id), { ...f.payload, sourceType: 'SUPPORT_TICKET',
          sourceId: String(ticket._id), userId: String(f.user._id) }), error => error.statusCode === 400);
        assert.equal((await SupportTicket.findById(ticket._id)).status, status);
        await assertUnchanged(f);
      });
    }

    for (const durationDays of [1, 3650]) {
      await t.test(`Tạm khóa tại biên ${durationDays} ngày lưu chính xác thời hạn`, async () => {
        const f = await fixture('TEMPORARY_SUSPEND');
        f.payload.penalty.durationDays = durationDays;
        const before = Date.now();
        const result = await createViolation(String(f.admin._id), f.payload);
        const after = Date.now();
        const duration = durationDays * 86400000;
        assert.ok(result.endAt.getTime() >= before + duration);
        assert.ok(result.endAt.getTime() <= after + duration);
      });
    }

    await t.test('Hai hình phạt tạm khóa chồng nhau chỉ mở khi tất cả đều hết hạn', async () => {
      const f = await fixture('TEMPORARY_SUSPEND');
      const first = await createViolation(String(f.admin._id), f.payload);
      const anotherReport = await Report.create({ reporterId: f.admin._id, targetType: 'user', targetUserId: f.user._id,
        reportType: 'spam_chat', title: 'Báo cáo vi phạm khác', description: 'Gửi tin nhắn làm phiền nhiều lần' });
      const second = await createViolation(String(f.admin._id), { ...f.payload, sourceId: String(anotherReport._id) });
      await Violation.updateOne({ _id: second._id }, { endAt: new Date(Date.now() - 1000) });
      await refreshTemporaryLock(f.user._id);
      assert.equal((await User.findById(f.user._id)).status, 'locked');
      await Violation.updateOne({ _id: first._id }, { endAt: new Date(Date.now() - 1000) });
      await refreshTemporaryLock(f.user._id);
      assert.equal((await User.findById(f.user._id)).status, 'active');
      assert.equal(await Violation.countDocuments({ userId: f.user._id, status: 'active' }), 0);
    });

    for (const scenario of ['cùng trạng thái', 'khóa ADMIN khác', 'tài khoản không tồn tại', 'ID sai']) {
      await t.test(`Khóa thủ công từ chối ${scenario}`, async () => {
        const f = await fixture();
        let target = String(f.user._id);
        let status = 'locked';
        let expected = 400;
        if (scenario === 'cùng trạng thái') { status = 'active'; expected = 409; }
        if (scenario === 'khóa ADMIN khác') await User.updateOne({ _id: f.user._id }, { role: 'ADMIN' });
        if (scenario === 'tài khoản không tồn tại') { target = String(new mongoose.Types.ObjectId()); expected = 404; }
        if (scenario === 'ID sai') target = 'sai';
        await assert.rejects(updateUserStatus(String(f.admin._id), target, status), error => error.statusCode === expected);
        await assertUnchanged(f);
      });
    }

    async function queueJob(overrides = {}) {
      return ViolationEmail.create({ violationId: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(),
        to: 'khach@example.test', subject: 'Thông báo', text: 'Nội dung thử nghiệm', html: '<p>Nội dung thử nghiệm</p>', ...overrides });
    }

    for (const scenario of ['pending chưa tới giờ', 'processing còn lease', 'sent', 'failed']) {
      await t.test(`Worker không gửi công việc ${scenario}`, async st => {
        await ViolationEmail.deleteMany({});
        const status = scenario.startsWith('pending') ? 'pending' : scenario.startsWith('processing') ? 'processing' : scenario;
        const job = await queueJob({ status, nextAttemptAt: new Date(Date.now() + 60000) });
        const send = st.mock.method(mail, 'sendNotificationEmail', async () => {});
        await processViolationEmails();
        assert.equal(send.mock.callCount(), 0);
        assert.equal((await ViolationEmail.findById(job._id)).status, status);
      });
    }

    await t.test('Khôi phục công việc processing hết lease bằng lease mới', async st => {
      await ViolationEmail.deleteMany({});
      const job = await queueJob({ status: 'processing', attempts: 1, leaseId: 'lease-cu', nextAttemptAt: new Date(Date.now() - 1000) });
      st.mock.method(mail, 'sendNotificationEmail', async () => {
        const claimed = await ViolationEmail.findById(job._id);
        assert.notEqual(claimed.leaseId, 'lease-cu');
        const stale = await ViolationEmail.updateOne({ _id: job._id, leaseId: 'lease-cu' }, { status: 'failed' });
        assert.equal(stale.modifiedCount, 0);
      });
      await processViolationEmails();
      const saved = await ViolationEmail.findById(job._id);
      assert.equal(saved.status, 'sent');
      assert.equal(saved.attempts, 2);
    });

    await t.test('Công việc dừng ở lần gửi cuối được đánh dấu failed khi lease hết hạn', async st => {
      await ViolationEmail.deleteMany({});
      const job = await queueJob({ status: 'processing', attempts: 5, leaseId: 'lease-cu', nextAttemptAt: new Date(Date.now() - 1000) });
      const send = st.mock.method(mail, 'sendNotificationEmail', async () => {});
      await processViolationEmails();
      assert.equal(send.mock.callCount(), 0);
      assert.equal((await ViolationEmail.findById(job._id)).status, 'failed');
    });

    await t.test('SMTP lỗi đủ năm lần dừng ở failed, không đổi quyết định đã commit', async st => {
      await ViolationEmail.deleteMany({});
      const f = await fixture('TEMPORARY_SUSPEND');
      const result = await createViolation(String(f.admin._id), f.payload);
      const send = st.mock.method(mail, 'sendNotificationEmail', async () => { throw new Error('Lỗi SMTP giả lập'); });
      for (let attempt = 1; attempt <= 5; attempt++) {
        await ViolationEmail.updateOne({ violationId: result._id }, { nextAttemptAt: new Date(Date.now() - 1000) });
        await processViolationEmails();
        const job = await ViolationEmail.findOne({ violationId: result._id });
        assert.equal(job.attempts, attempt);
        assert.equal(job.status, attempt === 5 ? 'failed' : 'pending');
        assert.ok(job.nextAttemptAt.getTime() >= Date.now() + 60000 * 2 ** (attempt - 1) - 2000);
      }
      await processViolationEmails();
      assert.equal(send.mock.callCount(), 5);
      assert.equal((await User.findById(f.user._id)).status, 'locked');
      assert.equal((await Violation.findById(result._id)).status, 'active');
    });

    await t.test('Đã gửi SMTP nhưng lỗi ghi sent: giữ processing, sau hết lease có thể gửi lại cùng Message-ID', async st => {
      await ViolationEmail.deleteMany({});
      const job = await queueJob();
      const messages = [];
      st.mock.method(mail, 'sendNotificationEmail', async message => { messages.push(message.messageId); });
      const update = st.mock.method(ViolationEmail, 'updateOne', async () => { throw new Error('Lỗi ghi trạng thái giả lập'); });
      await assert.rejects(processViolationEmails(), /Lỗi ghi trạng thái giả lập/);
      assert.equal((await ViolationEmail.findById(job._id)).status, 'processing');
      update.mock.restore();
      await ViolationEmail.updateOne({ _id: job._id }, { nextAttemptAt: new Date(Date.now() - 1000) });
      await processViolationEmails();
      assert.equal(messages.length, 2);
      assert.equal(messages[0], messages[1]);
      assert.equal((await ViolationEmail.findById(job._id)).status, 'sent');
    });

    await t.test('Index chặn tạo hai email cho cùng quyết định', async () => {
      await ViolationEmail.deleteMany({});
      const job = await queueJob();
      await assert.rejects(queueJob({ violationId: job.violationId }), error => error.code === 11000);
      assert.equal(await ViolationEmail.countDocuments({ violationId: job.violationId }), 1);
    });

    await t.test('HTTP kiểm tra JWT thật, quyền ADMIN, validation và quyền sở hữu', async st => {
      const express = require('express');
      const jwt = require('jsonwebtoken');
      const fs = require('node:fs');
      const vm = require('node:vm');
      const ts = require('typescript');
      const { sendControllerError } = require('../src/utils/controllerError');
      const f = await fixture();
      const provider = await User.create({ email: 'provider-http@example.test', fullName: 'Lê Văn Nam', role: 'PROVIDER', providerOnboardingStatus: 'APPROVED' });
      // Chỉ dùng khóa kiểm thử trong tiến trình cô lập, không đọc cấu hình dự án.
      process.env.ACCESS_TOKEN_SECRET = 'handigo-violation-http-test-only';
      const token = (user, options = {}) => jwt.sign({ id: String(user._id), role: user.role, tokenVersion: user.tokenVersion ?? 0,
        ...options }, 'handigo-violation-http-test-only', { expiresIn: '5m' });
      const app = express();
      app.use(express.json());
      const routeFile = path.join(__dirname, '../src/routes/admin.routes.ts');
      const routeExports = {};
      const unrelated = new Proxy({}, { get: (_target, name) => name === '__esModule' ? true : () => {} });
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(routeFile, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      }).outputText, { exports: routeExports, require(name) {
        if (name === 'express') return express;
        if (['../controllers/violation.controller', '../controllers/admin.controller',
          '../middlewares/auth.middleware', '../middlewares/role.middleware', '../middlewares/validate.middleware',
          '../validations/violation.validator', '../validations/admin.validator'].includes(name)) return require(name.replace('../', '../src/'));
        return unrelated;
      } });
      app.use('/admin', routeExports.default);
      app.use('/violations', require('../src/routes/violation.routes').default);
      app.use((error, _req, res, _next) => sendControllerError(res, error));
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      st.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
      const base = `http://127.0.0.1:${server.address().port}`;
      async function request(accessToken, body = f.payload, pathname = '/admin/violations', method = 'POST') {
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        return fetch(base + pathname, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
      }
      for (const [label, accessToken, expected] of [
        ['thiếu JWT', undefined, 401], ['JWT sai', 'sai', 401],
        ['JWT hết hạn', jwt.sign({ id: String(f.admin._id) }, 'handigo-violation-http-test-only', { expiresIn: -1 }), 401],
        ['JWT không có người dùng', token({ _id: new mongoose.Types.ObjectId(), role: 'ADMIN' }), 401],
        ['CUSTOMER', token(f.user), 403], ['giả role ADMIN trong JWT', token(f.user, { role: 'ADMIN' }), 403],
        ['PROVIDER', token(provider), 403],
        ['tokenVersion cũ', token(f.admin, { tokenVersion: 99 }), 401],
      ]) await st.test(`${label}: HTTP ${expected}`, async () => {
        assert.equal((await request(accessToken)).status, expected);
        await assertUnchanged(f);
      });

      const adminToken = token(f.admin);
      await st.test('API tạo vi phạm từ chối userId/orderId bị thay ngữ cảnh', async () => {
        const fresh = await fixture('TEMPORARY_SUSPEND');
        for (const extra of [{ userId: String(f.user._id) }, { orderId: String(new mongoose.Types.ObjectId()) }]) {
          const response = await request(adminToken, { ...fresh.payload, ...extra });
          assert.equal(response.status, 400);
          await assertUnchanged(fresh);
        }
      });
      const invalidBodies = [
        ['thiếu penalty', { ...f.payload, penalty: undefined }], ['sai sourceId', { ...f.payload, sourceId: 'sai' }],
        ['sai userId', { ...f.payload, userId: 'sai' }], ['sai severity', { ...f.payload, severity: 'UNKNOWN' }],
        ['sai sourceType', { ...f.payload, sourceType: 'UNKNOWN' }], ['lý do rỗng', { ...f.payload, reason: '    ' }],
        ['quyết định quá dài', { ...f.payload, adminDecision: 'a'.repeat(3001) }],
        ...[undefined, null, 0, -1, 0.5, '3', 3651].map(durationDays => [`thời hạn ${String(durationDays)}`, {
          ...f.payload, penalty: { type: 'TEMPORARY_SUSPEND', durationDays },
        }]),
      ];
      for (const [label, body] of invalidBodies) await st.test(`${label}: HTTP 400 trước ghi database`, async () => {
        const response = await request(adminToken, body);
        assert.equal(response.status, 400);
        assert.equal((await response.json()).code, 'VALIDATION_ERROR');
        await assertUnchanged(f);
      });

      for (const [label, change] of [ ['ADMIN bị khóa', { status: 'locked' }], ['ADMIN đã xóa', { isDeleted: true }] ]) {
        await st.test(`${label}: bị từ chối dù JWT còn hạn`, async () => {
          await User.updateOne({ _id: f.admin._id }, change);
          assert.equal((await request(adminToken)).status, change.status ? 403 : 401);
          await User.updateOne({ _id: f.admin._id }, { status: 'active', isDeleted: false });
          await assertUnchanged(f);
        });
      }

      await st.test('Không nhận handledBy/email/status do client chèn', async () => {
        const response = await request(adminToken, { ...f.payload, handledBy: String(f.user._id), email: 'sai@example.test', status: 'resolved' });
        assert.equal(response.status, 201);
        const item = (await response.json()).data;
        assert.equal(item.handledBy._id, String(f.admin._id));
        assert.equal(item.status, 'active');
        assert.equal((await ViolationEmail.findOne({ violationId: item._id })).to, f.user.email);
      });

      await st.test('Đọc /me luôn theo JWT dù query userId là người khác', async () => {
        const response = await request(token(f.user), null, `/violations/me?userId=${f.admin._id}`, 'GET');
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.data.items.length, 1);
        assert.ok(body.data.items.every(item => item.userId._id === String(f.user._id)));
      });

      await st.test('Đọc chi tiết quản trị: CUSTOMER bị chặn; mã sai 400, không tồn tại 404', async () => {
        assert.equal((await request(token(f.user), null, `/admin/violations/${new mongoose.Types.ObjectId()}`, 'GET')).status, 403);
        assert.equal((await request(adminToken, null, '/admin/violations/sai', 'GET')).status, 400);
        assert.equal((await request(adminToken, null, `/admin/violations/${new mongoose.Types.ObjectId()}`, 'GET')).status, 404);
      });

      for (const query of ['page=0', 'limit=51', 'status=unknown', 'severity=unknown', 'userId=sai']) {
        await st.test(`Danh sách quản trị query ${query}: HTTP 400`, async () => {
          assert.equal((await request(adminToken, null, `/admin/violations?${query}`, 'GET')).status, 400);
        });
      }

      await st.test('Lỗi database qua HTTP trả 500 chung, rollback dữ liệu và không lộ lỗi nội bộ', async nested => {
        const fresh = await fixture('TEMPORARY_SUSPEND');
        nested.mock.method(ViolationEmail, 'create', async () => { throw new Error('noi-bo-khong-duoc-lo'); });
        const response = await request(adminToken, fresh.payload);
        assert.equal(response.status, 500);
        assert.ok(!JSON.stringify(await response.json()).includes('noi-bo-khong-duoc-lo'));
        await assertUnchanged(fresh);
      });

      for (const manual of [false, true]) {
        await st.test(`JWT cũ bị từ chối sau khi ${manual ? 'khóa/mở thủ công' : 'tạm khóa rồi hết hạn'}`, async () => {
          const fresh = await fixture('TEMPORARY_SUSPEND');
          const oldAccessToken = token(fresh.user);
          if (manual) {
            await updateUserStatus(String(fresh.admin._id), String(fresh.user._id), 'locked');
            await updateUserStatus(String(fresh.admin._id), String(fresh.user._id), 'active');
          } else {
            const result = await createViolation(String(fresh.admin._id), fresh.payload);
            await Violation.updateOne({ _id: result._id }, { endAt: new Date(Date.now() - 1000) });
            await refreshTemporaryLock(fresh.user._id);
          }
          assert.equal((await User.findById(fresh.user._id)).status, 'active');
          assert.equal((await request(oldAccessToken, null, '/violations/me', 'GET')).status, 401);
          const renewed = token(await User.findById(fresh.user._id));
          assert.equal((await request(renewed, null, '/violations/me', 'GET')).status, 200);
        });
      }
    });
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
