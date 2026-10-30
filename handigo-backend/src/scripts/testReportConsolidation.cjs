const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { Report } = require('../models/report.model');
const { complaintToReport } = require('../services/complaintReportMigration');
const validators = require('../validations/report.validator');
const { Complaint } = require('../models/complaint.model');
const { Violation } = require('../models/violation.model');
const { AppError } = require('../utils/appError');
const { withTransactionRetry } = require('../utils/transaction');

// Dùng document và delta Mongoose thật; transaction/database được cô lập.
const customer = new mongoose.Types.ObjectId();
const providerUser = new mongoose.Types.ObjectId();
const admin = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
const providerId = new mongoose.Types.ObjectId();
let state, version, hold, reached, pauseKind, failEvidence;
const copy = value => {
  if (value instanceof Date) return new Date(value);
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== 'function').map(([key, item]) => [key, copy(item)]));
  return value;
};
const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
function set(row, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  let target = row;
  for (const part of parts) target = target[part] ??= {};
  target[last] = copy(value);
}
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  const actual = get(row, key);
  if (value && '$in' in Object(value)) return value.$in.some(item => String(item) === String(actual));
  if (value && '$ne' in Object(value)) return String(actual) !== String(value.$ne);
  return value == null ? actual == null : String(actual) === String(value);
});
function apply(row, update) {
  for (const [key, value] of Object.entries(update.$set ?? {})) set(row, key, value);
  for (const [key, value] of Object.entries(update.$inc ?? {})) set(row, key, (get(row, key) ?? 0) + value);
  for (const [key, value] of Object.entries(update)) if (!key.startsWith('$')) set(row, key, value);
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function pause(kind) {
  if (pauseKind !== kind) return;
  pauseKind = null; reached.resolve(); await hold.promise;
}
const view = session => session?.snapshot ?? state;
const connection = { startSession: async () => ({
  async withTransaction(work) {
    const previous = version;
    this.snapshot = copy(state);
    const result = await work(this);
    if (previous !== version) throw Object.assign(new Error('Xung đột giao dịch giả lập'), { code: 112 });
    state = this.snapshot; version++;
    return result;
  },
  async endSession() {},
}) };
const constructors = { reports: Report, violations: Violation };
function document(row, collection, session) {
  if (!row) return null;
  if (!constructors[collection]) return copy(row);
  const doc = constructors[collection].hydrate(copy(row));
  doc.save = async (options = {}) => {
    const activeSession = options.session ?? session;
    assert.ok(activeSession, 'Mọi lần ghi phải thuộc giao dịch.');
    if (collection === 'reports') {
      if (doc.isModified('evidenceFiles')) { await pause('evidence'); if (failEvidence) throw new Error('Lỗi lưu bằng chứng'); }
      const index = view(activeSession).reports.findIndex(row => String(row._id) === String(doc._id));
      view(activeSession).reports[index] = copy(doc.toObject()); return doc;
    }

  };
  return doc;
}
function query(work) {
  return { session(session) { this.context = session; return this; }, select() { return this; }, populate() { return this; }, lean() { return this; },
    skip() { return this; }, limit() { return this; }, sort(order) { this.order = order; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => work(this.context, this.order)).then(resolve, reject); } };
}
function model(collection) {
  return {
    countDocuments: filter => query(session => view(session)[collection].filter(row => matches(row, filter)).length),
    findOne: filter => query((session, order) => {
      let rows = view(session)[collection].filter(row => matches(row, filter));
      if (order) rows = rows.sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || String(right._id).localeCompare(String(left._id)));
      return document(rows[0], collection, session);
    }),
    findById: id => query(session => document(view(session)[collection].find(row => String(row._id) === String(id)), collection, session)),
    find: filter => query(session => view(session)[collection].filter(row => matches(row, filter)).map(row => document(row, collection, session))),
    findOneAndUpdate: (filter, update, options) => query(() => {
      assert.ok(options.session); assert.equal(options.runValidators, true);
      const row = view(options.session)[collection].find(item => matches(item, filter));
      if (!row) return null;
      apply(row, update); return document(row, collection, options.session);
    }),
    updateOne: async (filter, update, options) => {
      assert.ok(options.session); assert.equal(options.runValidators, true);
      const row = view(options.session)[collection].find(item => matches(item, filter));
      if (!row) return { matchedCount: 0 };
      apply(row, update); return { matchedCount: 1 };
    },
    create: async (rows, { session }) => {
      if (collection === 'reports') await pause('create');
      if (collection === 'violations') await pause('violation');
      return rows.map(row => {
        const value = new constructors[collection]({ ...row, createdAt: new Date(), updatedAt: new Date() }).toObject();
        view(session)[collection].push(value); return document(value, collection, session);
      });
    },
    insertMany: async (rows, { session }) => {
      assert.ok(session); await pause('evidence');
      view(session)[collection].push(...copy(rows));
      if (failEvidence) throw new Error('Lỗi lưu bằng chứng giả lập');
    },
  };
}
function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, require: name => name in modules ? modules[name] : require(name) });
  return exports;
}
const modules = {
  mongoose: { __esModule: true, default: connection, Types: mongoose.Types },
  '../utils/transaction': { withTransactionRetry }, '../utils/appError': { AppError },
  '../models/report.model': { Report: model('reports') },
  '../models/conversation.model': {}, '../models/feedback.model': {}, '../models/user.model': {},
  '../models/order.model': { Order: model('orders') },
  '../models/provider.model': { Provider: { findOne: () => query(() => ({ _id: providerId, userId: providerUser })) } },
  '../models/orderStatus.model': { OrderStatus: { findOne: () => query(() => ({ createdAt: state.completedAt })) } },
  '../validations/report.validator': validators,
  './customerNoShow.service': { reviewCustomerNoShowReport: async () => { throw new Error('Quy trình vắng mặt riêng'); } },
  './customerNoShowVerification.service': { getAdminNoShowDetails: async () => ({}) },
};
modules['./reportQuality.service'] = load('../services/reportQuality.service', modules);
const reports = load('../services/report.service', modules);
modules['./report.service'] = reports;
const complaints = load('../services/complaint.service', modules);
function reset() {
  version = 0; hold = deferred(); reached = deferred(); pauseKind = null; failEvidence = false;
  state = { completedAt: new Date(), orders: [{ _id: orderId, customerId: customer, providerId, status: 'completed', isDeleted: false, updatedAt: new Date() }], reports: [], violations: [] };
}
const payload = { orderId: String(orderId), title: 'Báo cáo chất lượng', description: 'Nội dung cần được xử lý' };
const reportPayload = { ...payload, targetType: 'order', reportType: 'service_quality' };
const files = [{ fileType: 'image', url: 'https://example.test/bang-chung.jpg' }];
async function run() {
  reset(); pauseKind = 'create';
  const first = reports.createReport(String(customer), 'CUSTOMER', reportPayload);
  await reached.promise;
  const created = await complaints.createComplaint(String(customer), 'CUSTOMER', payload);
  hold.resolve(); await assert.rejects(first, /đã tạo khiếu nại/);
  assert.equal(state.reports.length, 1);
  assert.equal(String(created.complainantId), String(customer));
  await complaints.createComplaint(String(providerUser), 'PROVIDER', payload);
  assert.equal(state.reports.length, 2);
  for (const target of ['confirmed', 'resolved', 'rejected', 'cancelled']) {
    reset();
    const created = await reports.createReport(String(customer), 'CUSTOMER', reportPayload);
    const id = String(created._id);
    await reports.requestReportEvidence(String(admin), id, 'Vui lòng bổ sung hình ảnh');
    pauseKind = 'evidence';
    const adding = reports.addReportEvidence(String(customer), 'CUSTOMER', id, { files });
    await reached.promise;
    if (target === 'cancelled') await reports.cancelReport(String(customer), id);
    else await reports.reviewReport(String(admin), id, { status: target });
    hold.resolve(); await assert.rejects(adding, /đã kết thúc/);
    assert.equal(state.reports[0].status, target);
    assert.equal(state.reports[0].evidenceFiles.length, 0);
    await assert.rejects(reports.cancelReport(String(customer), id), /đã kết thúc/);
  }
  reset();
  const result = await reports.createReport(String(customer), 'CUSTOMER', reportPayload);
  const id = String(result._id);
  await reports.requestReportEvidence(String(admin), id, 'Vui lòng bổ sung hình ảnh');
  await reports.addReportEvidence(String(customer), 'CUSTOMER', id, { files, note: 'Ảnh bổ sung' });
  assert.equal(state.reports[0].status, 'under_review');
  const oldView = await complaints.getComplaintForUser(String(customer), id);
  assert.equal(oldView.evidence.length, 1); assert.equal(oldView.evidence[0].note, 'Ảnh bổ sung');
  assert.ok(oldView.evidence[0].createdAt instanceof Date);
  failEvidence = true;
  await assert.rejects(reports.addReportEvidence(String(customer), 'CUSTOMER', id, { files }), /Lỗi lưu bằng chứng/);
  assert.equal(state.reports[0].evidenceFiles.length, 1); failEvidence = false;
  for (const action of [() => reports.cancelReport(String(admin), id), () => reports.addReportEvidence(String(admin), 'CUSTOMER', id, { files }), () => reports.getReportForUser(String(admin), id)]) await assert.rejects(action, /Không tìm thấy/);
  await reports.cancelReport(String(customer), id);
  await assert.rejects(complaints.createComplaint(String(customer), 'CUSTOMER', payload), /đã tạo khiếu nại/);
  reset(); state.orders[0].status = 'in_progress';
  await assert.rejects(reports.createReport(String(customer), 'CUSTOMER', reportPayload), /đã hoàn thành/);
  reset(); state.completedAt = new Date(Date.now() - 4 * 86400000);
  await assert.rejects(reports.createReport(String(customer), 'CUSTOMER', reportPayload), /3 ngày/);
  reset(); await assert.rejects(reports.createReport(String(admin), 'CUSTOMER', reportPayload), /không có quyền/);
  assert.equal(validators.createReportSchema.safeParse({ ...reportPayload, targetType: 'system', orderId: undefined }).success, false);
  assert.equal(validators.addReportEvidenceSchema.safeParse({ files: [] }).success, false);
  state.reports.push(new Report({ ...reportPayload, reporterId: customer, isCustomerNoShow: true }).toObject());
  const noShowId = String(state.reports[0]._id);
  for (const action of [() => reports.cancelReport(String(customer), noShowId), () => reports.addReportEvidence(String(customer), 'CUSTOMER', noShowId, { files }), () => reports.requestReportEvidence(String(admin), noShowId, 'Bổ sung bằng chứng')]) await assert.rejects(action, /quy trình xác minh riêng/);
  const legacy = new Complaint({ ...payload, complainantId: customer, complainantRole: 'CUSTOMER', targetUserId: providerUser, status: 'resolved', createdViolationId: new mongoose.Types.ObjectId(), createdAt: new Date(1700000000000), updatedAt: new Date(1700000001000) });
  const evidence = { _id: new mongoose.Types.ObjectId(), fileType: 'image', url: files[0].url, uploadedBy: customer, note: 'Ghi chú cũ', createdAt: new Date(1700000000500), isDeleted: false };
  const mapped = complaintToReport(legacy, [evidence, { ...evidence, isDeleted: true }]);
  await new Report(mapped).validate();
  assert.equal(String(mapped._id), String(legacy._id)); assert.equal(mapped.status, 'confirmed'); assert.equal(mapped.evidenceFiles.length, 1);
  assert.equal(mapped.evidenceFiles[0].note, 'Ghi chú cũ'); assert.equal(mapped.evidenceFiles[0].uploadedAt, evidence.createdAt);
  assert.equal(mapped.createdAt, legacy.createdAt); assert.equal(mapped.updatedAt, legacy.updatedAt);
  await migrationCases(legacy, evidence);
  await violationCases();
  reset();
  const ordinary = await reports.createReport(String(customer), 'CUSTOMER', { ...reportPayload, reportType: 'user_behavior' });
  assert.equal(ordinary.reportType, 'user_behavior');
  assert.equal(state.reports.length, 1, 'Báo cáo thông thường vẫn tạo được qua API hiện tại.');
  console.log('Đạt: hai API dùng chung, chống trùng đồng thời, khóa trạng thái, quyền sở hữu, thời hạn, hoàn tác bằng chứng, luồng vắng mặt và chuyển dữ liệu cũ.');
}

async function violationCases() {
  const reportModel = model('reports');
  const violations = load('../services/violation.service', {
    ...modules,
    mongoose: { __esModule: true, Types: mongoose.Types, default: { connection: { transaction: async work => {
      const session = await connection.startSession();
      return withTransactionRetry(session, work);
    } } } },
    '../models/report.model': { Report: { ...reportModel, findByIdAndUpdate: (id, update, options) => reportModel.findOneAndUpdate({ _id: id }, update, options) } },
    '../models/violation.model': { Violation: model('violations') },
    '../models/session.model': {}, '../models/supportTicket.model': {},
    '../models/user.model': { __esModule: true, default: { findOne: () => query(() => ({ _id: providerUser, role: 'PROVIDER' })) } },
    '../sockets/socketServer': { disconnectUserSockets() {} },
    './penaltyPolicy.service': {},
  });
  for (const competingAction of ['violation', 'cancel']) {
    reset();
    const created = await reports.createReport(String(customer), 'CUSTOMER', reportPayload);
    const id = String(created._id);
    const decision = { sourceId: id, sourceType: 'REPORT', violationType: 'Chất lượng dịch vụ', severity: 'LOW', reason: 'Đã đối chiếu hồ sơ', adminDecision: 'Ghi nhận cảnh cáo', penalty: { type: 'WARNING' } };
    pauseKind = 'violation';
    const first = violations.createViolation(String(admin), decision);
    await reached.promise;
    if (competingAction === 'violation') {
      const result = await violations.createViolation(String(admin), { ...decision, sourceType: 'COMPLAINT' });
      assert.equal(result.sourceType, 'REPORT', 'Nguồn tương thích phải chuyển sang báo cáo.');
      assert.equal(String(result.relatedReportId), id);
    } else await reports.cancelReport(String(customer), id);
    hold.resolve();
    await assert.rejects(first, competingAction === 'violation' ? /đã có bản ghi vi phạm/ : /đã hủy hoặc từ chối/);
    assert.equal(state.violations.length, competingAction === 'violation' ? 1 : 0);
    assert.equal(state.reports[0].status, competingAction === 'violation' ? 'confirmed' : 'cancelled');
  }
}

async function migrationCases(legacy, evidence) {
  const rows = new Map();
  const violation = { sourceType: 'COMPLAINT', relatedComplaintId: legacy._id };
  let writes = 0;
  let disconnected = 0;
  let migratedId = legacy._id;
  const FakeReport = function(payload) { return new Report(payload); };
  FakeReport.findById = id => ({ session: async () => rows.get(String(id)) ?? null });
  FakeReport.create = async ([payload], options) => {
    assert.equal(options.timestamps, false);
    writes++; rows.set(String(payload._id), new Report(payload).toObject());
  };
  FakeReport.createIndexes = async () => {};
  const dependencies = {
    mongoose: { __esModule: true, default: {
      connect: async () => {}, disconnect: async () => { disconnected++; },
      connection: { transaction: async work => work({}) },
    } },
    '../models/complaint.model': { Complaint: { find: () => ({ cursor: async function*() { yield legacy; } }) } },
    '../models/complaintEvidence.model': { ComplaintEvidence: { find: () => ({ session: async () => [evidence] }) } },
    '../models/report.model': { Report: FakeReport },
    '../models/violation.model': { Violation: { updateMany: async (filter, update, options) => {
      assert.equal(options.runValidators, true);
      assert.equal(String(filter.relatedComplaintId), String(migratedId));
      if (violation.sourceType === filter.sourceType) Object.assign(violation, update.$set);
    } } },
    '../services/complaintReportMigration': { complaintToReport },
  };
  const code = ts.transpileModule(fs.readFileSync(require.resolve('./migrateComplaintsToReports.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText.replace('migrate().catch', 'globalThis.migrationRun = migrate().catch');
  const invoke = async apply => {
    const context = { exports: {}, process: { env: { MONGODB_URI: 'mongodb://test.invalid/kiem-thu' }, argv: apply ? ['--apply'] : [], exitCode: 0 },
      console: { log() {}, error() {} }, require: name => dependencies[name] };
    vm.runInNewContext(code, context);
    await context.migrationRun;
    return context.process.exitCode;
  };
  assert.equal(await invoke(false), 0);
  assert.equal(writes, 0, 'Chạy thử không ghi dữ liệu.');
  assert.equal(violation.sourceType, 'COMPLAINT');
  assert.equal(await invoke(true), 0);
  assert.equal(await invoke(true), 0);
  assert.equal(writes, 1, 'Chạy lại không chèn trùng hoặc ghi đè hồ sơ đã chuyển.');
  assert.equal(violation.sourceType, 'REPORT');
  assert.equal(String(violation.relatedReportId), String(legacy._id));
  assert.equal(String(violation.relatedComplaintId), String(legacy._id));
  assert.equal(rows.get(String(legacy._id)).createdAt.getTime(), legacy.createdAt.getTime());
  rows.set(String(legacy._id), { legacyComplaintId: new mongoose.Types.ObjectId() });
  assert.equal(await invoke(true), 1, 'Trùng định danh với hồ sơ khác phải dừng migration.');
  assert.equal(writes, 1);
  assert.equal(disconnected, 4, 'Luôn đóng kết nối cả khi migration lỗi.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
