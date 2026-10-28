const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function load(relative, modules = {}) {
  const filename = path.join(__dirname, '../src', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports, Date, Map, Set, Error, require: name => modules[name] ?? {} }, { filename });
  return exports;
}
const time = load('utils/customerNoShowEvidence.ts');
const verification = load('services/customerNoShowVerification.service.ts', {
  '../utils/customerNoShowEvidence': time,
  '../utils/logger': { createLogger: () => ({ warn() {} }) },
});
const adminId = new Types.ObjectId().toString();
const reportId = new Types.ObjectId().toString();
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
const query = value => ({ session() { return this; }, select() { return this; }, lean: async () => value,
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

function setup(options = {}) {
  const writes = [];
  const audits = [];
  let ended = false;
  const session = { endSession: async () => { ended = true; } };
  const previous = { decision: 'manual_review', checkedAt: new Date('2026-10-28T09:12:00+07:00'), policyVersion: 'HANDIGO_NO_SHOW_AI_V4',
    reasons: ['Chỉ xác minh được 2/3 cuộc gọi đi không được trả lời tới đúng số khách trong thời gian chờ.', 'Cuộc gọi 3: Cuộc gọi nằm ngoài khoảng thời gian đối chiếu.', ...(options.extraReasons ?? [])],
    checks: { location: { passed: true, distanceMeters: 104.3, radiusMeters: 200 },
      waiting: { passed: true, skippedForTesting: false, waitStartedAt: new Date('2026-10-28T09:01:30+07:00'), requiredMinutes: 10 },
      calls: { passed: false, validCount: 2, requiredCount: 3 }, chat: { passed: true, messageCount: 1, customerReplied: false } },
  };
  const report = { _id: new Types.ObjectId(reportId), isCustomerNoShow: true, reporterId: new Types.ObjectId(), orderId: new Types.ObjectId(),
    status: options.status ?? 'pending', noShowVerification: options.noSnapshot ? null : structuredClone(previous),
    toObject() { return { noShowVerification: structuredClone(this.noShowVerification) }; },
    async save(writeOptions) { assert.equal(writeOptions.session, session); writes.push('report'); },
  };
  const receipts = [
    { _id: new Types.ObjectId(), kind: 'arrival', analysisStatus: 'analyzed', analysis: { imageType: 'arrival' } },
    { _id: new Types.ObjectId(), kind: 'contact', analysisStatus: 'analyzed', uploadedAt: new Date('2026-10-28T09:11:30+07:00'),
      analysis: { imageType: 'call', contactOutcome: 'no_answer', calls: ['09:01', '09:02', '09:03'].map(clock => ({
        phoneNumber: '0773368198', dateLabel: 'Hôm nay', time: clock, occurredAt: null, direction: 'outgoing', outcome: 'no_answer',
      })) } },
  ];
  const order = { _id: report.orderId, status: 'accepted', customerId: new Types.ObjectId(),
    addressSnapshot: { recipientPhone: '0773368198' }, customerNoShow: { status: 'pending', evidenceIds: receipts.map(item => item._id) } };
  const { reverifyCustomerNoShowCalls } = load('services/customerNoShowReverification.service.ts', {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../utils/appError': { AppError }, './customerNoShowVerification.service': verification,
    '../utils/transaction': { withTransactionRetry: async (received, work) => {
      assert.equal(received, session);
      const snapshot = structuredClone(report.noShowVerification);
      try { return await work(session); } catch (error) { report.noShowVerification = snapshot; throw error; }
    } },
    '../models/report.model': { Report: { findOne: filter => { assert.equal(filter.isCustomerNoShow, true); return query(report); } } },
    '../models/order.model': { Order: { findOne: filter => { assert.equal(filter['customerNoShow.status'], 'pending'); assert.equal(filter.status, 'accepted'); return query(options.missingOrder ? null : order); } } },
    '../models/customerNoShowEvidence.model': { CustomerNoShowEvidence: { find: filter => {
      assert.equal(String(filter.providerUserId), String(report.reporterId)); return query(options.missingEvidence ? [] : receipts);
    } } },
    '../models/user.model': { __esModule: true, default: { findOne: () => query({ phone: '0773368198' }) } },
    '../models/auditLog.model': { AuditLog: { create: async (items, writeOptions) => {
      assert.equal(writeOptions.session, session);
      if (options.auditFails) throw new Error('Không lưu được lịch sử');
      audits.push(...items);
    } } },
  });
  return { run: () => reverifyCustomerNoShowCalls(adminId, reportId), report, order, previous, writes, audits, ended: () => ended };
}

test('Xác minh lại đổi 2/3 thành 3/3, lưu audit trước/sau và giữ nguyên trạng thái, mốc chờ, vị trí, chat', async () => {
  const context = setup();
  await context.run();
  const current = context.report.noShowVerification;
  assert.equal(current.checks.calls.validCount, 3);
  assert.equal(current.checks.calls.passed, true);
  assert.equal(current.policyVersion, 'HANDIGO_NO_SHOW_AI_V5');
  assert.equal(current.decision, 'auto_eligible');
  assert.equal(+current.checkedAt, +context.previous.checkedAt);
  assert.equal(+current.checks.waiting.waitStartedAt, +context.previous.checks.waiting.waitStartedAt);
  assert.equal(current.checks.location.distanceMeters, 104.3);
  assert.equal(current.checks.chat.passed, true);
  assert.equal(context.report.status, 'pending');
  assert.equal(context.order.status, 'accepted');
  assert.equal(context.order.customerNoShow.status, 'pending');
  assert.equal(context.audits.length, 1);
  assert.equal(context.audits[0].actorRole, 'admin');
  assert.equal(context.audits[0].oldValue.noShowVerification.checks.calls.validCount, 2);
  assert.equal(context.audits[0].newValue.noShowVerification.checks.calls.validCount, 3);
  assert.ok(context.audits[0].newValue.reverifiedAt instanceof Date);
  assert.equal(context.ended(), true);
});

test('Đủ cuộc gọi vẫn giữ lý do cần xem xét khác, không tự duyệt hồ sơ', async () => {
  const context = setup({ extraReasons: ['Khách đã phản hồi trong thời gian chờ; cần quản trị viên xem xét.'] });
  await context.run();
  assert.equal(context.report.noShowVerification.checks.calls.validCount, 3);
  assert.equal(context.report.noShowVerification.decision, 'manual_review');
  assert.match(context.report.noShowVerification.reasons.join(), /Khách đã phản hồi/);
  assert.doesNotMatch(context.report.noShowVerification.reasons.join(), /Chỉ xác minh được 2|Cuộc gọi 3:/);
});

test('Báo cáo đã xử lý, thiếu snapshot hoặc bằng chứng không được thay kết quả', async () => {
  for (const options of [{ status: 'confirmed' }, { status: 'rejected' }, { noSnapshot: true }, { missingOrder: true }, { missingEvidence: true }]) {
    const context = setup(options);
    await assert.rejects(context.run(), error => error.statusCode === 409);
    assert.equal(context.writes.length, 0);
    assert.equal(context.audits.length, 0);
    assert.equal(context.ended(), true);
  }
});

test('Lỗi lưu audit làm hủy transaction và kết thúc session, không để lại kết quả mới thiếu lịch sử', async () => {
  const context = setup({ auditFails: true });
  await assert.rejects(context.run(), /Không lưu được lịch sử/);
  assert.equal(context.report.noShowVerification.checks.calls.validCount, 2);
  assert.equal(context.audits.length, 0);
  assert.equal(context.ended(), true);
});

test('Endpoint xác minh lại nằm sau xác thực ADMIN và có validation mã báo cáo', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/admin.routes.ts'), 'utf8');
  const roleIndex = routes.indexOf('router.use(authMiddleware, roleMiddleware("ADMIN"))');
  const routeIndex = routes.indexOf('"/reports/:id/reverify"');
  assert.ok(roleIndex >= 0 && routeIndex > roleIndex);
  assert.match(routes.slice(routeIndex, routeIndex + 140), /validate\(reportIdSchema, "params"\)/);
});
