const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
require('ts-node/register/transpile-only');
const { AppError } = require('../utils/appError');
const validation = require('../ai/admin/admin-ai.validation');

const now = new Date('2026-11-04T10:00:00Z');
const old = new Date('2026-10-01T00:00:00Z');
const oid = number => number.toString(16).padStart(24, '0');
let state, generated, sequence;
const copy = value => {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(copy);
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== 'function').map(([key, item]) => [key, copy(item)]));
};
const matches = (row, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some(condition => matches(row, condition));
  const actual = row[key];
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if ('$in' in expected) return expected.$in.includes(actual);
    if ('$nin' in expected) return !expected.$nin.includes(actual);
    if ('$ne' in expected) return actual !== expected.$ne;
    if ('$gt' in expected) return actual > expected.$gt;
    if ('$lt' in expected) return actual < expected.$lt;
    if ('$lte' in expected) return actual <= expected.$lte;
  }
  return expected == null ? actual == null : actual instanceof Date ? +actual === +expected : actual === expected;
});
const query = work => {
  let sorting, limit;
  const resolve = () => {
    const result = work();
    if (!Array.isArray(result)) return result;
    if (sorting) result.sort((a, b) => {
      for (const [key, direction] of Object.entries(sorting)) {
        if (a[key] < b[key]) return -direction;
        if (a[key] > b[key]) return direction;
      }
      return 0;
    });
    return limit === undefined ? result : result.slice(0, limit);
  };
  return { select() { return this; }, session() { return this; },
    sort(value) { sorting = value; return this; }, limit(value) { limit = value; return this; },
    lean() { return Promise.resolve(copy(resolve())); },
    then(onFulfilled, onRejected) { return Promise.resolve().then(resolve).then(onFulfilled, onRejected); } };
};
const model = collection => ({
  find: filter => query(() => state[collection].filter(row => matches(row, filter))),
  findOne: filter => query(() => {
    const row = state[collection].find(item => matches(item, filter));
    if (!row || collection !== 'configs') return copy(row) || null;
    const document = copy(row);
    document.toObject = () => copy(document);
    document.save = async () => { Object.assign(row, copy(document)); };
    return document;
  }),
  findOneAndUpdate: (filter, update, options) => query(() => {
    let row = state[collection].find(item => matches(item, filter));
    if (!row && options?.upsert) {
      row = { _id: oid(++sequence), status: 'queued', attempts: 0, nextAt: old, ...copy(update.$setOnInsert) };
      state[collection].push(row);
    }
    if (row) Object.assign(row, copy(update.$set || {}));
    return copy(row) || null;
  }),
  updateOne: (filter, update, options) => {
    assert.equal(options?.runValidators, true);
    const row = state[collection].find(item => matches(item, filter));
    if (row) Object.assign(row, copy(update.$set || {}));
    return Promise.resolve({ modifiedCount: row ? 1 : 0 });
  },
  create: async rows => { state[collection].push(...copy(rows)); },
});
const policy = validation.policySchema.parse({ criteria: [
  { code: 'description', kind: 'description_length', description: 'Mô tả đủ nội dung', required: true, value: 1 },
  { code: 'relevance', kind: 'ai', description: 'Phù hợp danh mục', required: true },
] });
const config = (feature, enabled = true) => ({ _id: oid(++sequence), feature, enabled, revision: 1,
  configuredBy: oid(900), draft: policy, policy, enabledSince: now, cursorAt: null, cursorId: null });
const row = (number, status = 'pending', extra = {}) => ({ _id: oid(number), status, isDeleted: false,
  description: 'Dữ liệu kiểm thử', updatedAt: old, applicationType: 'initial', ...extra });
const reset = () => {
  sequence = 1000; generated = 0;
  state = { configs: [], history: [], assessments: [], users: [], provider_application: [], service_suggestion: [], report: [], complaint: [], support_ticket: [] };
};
const models = {
  AdminAIConfig: model('configs'), AdminAIConfigHistory: model('history'),
  AdminAIAssessment: model('assessments'),
  AdminAIQuota: { updateOne: async () => ({}), findOneAndUpdate: async () => ({ count: 1 }) },
};
const context = {
  sourceModel: type => model(type),
  loadContext: async input => {
    const source = state[input.sourceType].find(item => item._id === input.sourceId);
    if (!source) throw new AppError('Không tìm thấy nguồn.', 404);
    return { row: copy(source), sources: [], hash: JSON.stringify(source), catalogComplete: true };
  },
};
const dependencies = {
  mongoose: { ...mongoose, startSession: async () => ({ withTransaction: work => work(), endSession: async () => {} }) },
  '../../models/user.model': model('users'), '../../models/service.model': { Service: {} }, '../../models/category.model': { Category: {} },
  '../../services/providerApplication.service': {}, '../../services/serviceSuggestion.service': {}, './admin-ai.images': {},
  '../../utils/appError': { AppError }, './admin-ai.models': models, './admin-ai.validation': validation,
  './admin-ai.provider': { adminAIConfig() {}, generateAdminAI: async () => {
    generated++;
    return { model: 'model-kiem-thu', usage: {}, output: { checks: [], missingData: [], categoryId: null, duplicateServiceIds: [] } };
  } },
  './admin-ai.context': context, './admin-ai.criteria': { evaluateCriteria: () => [], incompleteApplicationReasons: require('../ai/admin/admin-ai.criteria').incompleteApplicationReasons }, './admin-ai.complaint': {},
};
const file = path.resolve(__dirname, '../ai/admin/admin-ai.service.ts');
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exportsObject = {};
vm.runInNewContext(source, { exports: exportsObject, Date, structuredClone,
  require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name) }, { filename: file });
const { listSources, scanAutomaticSources, enqueueAssessment, processNextAssessment, changeConfig } = exportsObject;

async function run() {
  reset();
  for (const type of ['provider_application', 'service_suggestion', 'report', 'complaint', 'support_ticket']) {
    const pending = type === 'support_ticket' ? 'open' : 'pending';
    state[type] = [row(1, pending), row(2, type === 'provider_application' || type === 'service_suggestion' ? 'approved' : 'resolved'),
      row(3, 'rejected'), row(4, 'cancelled'), row(5, pending, { isDeleted: true })];
    assert.deepEqual((await listSources(type)).map(item => item.id), [oid(1)], `Danh sách ${type} còn tài nguyên đã xử lý.`);
  }
  state.report.push(row(6, 'pending', { isCustomerNoShow: true }), row(7, 'pending', { createdViolationId: oid(999) }), row(8, 'confirmed'));
  assert.deepEqual((await listSources('report')).map(item => item.id), [oid(1)]);

  reset();
  state.configs = [config('provider_application'), config('service_suggestion'), config('complaint_summary')];
  state.provider_application = [row(10), row(11, 'resubmitted'), row(12, 'approved'), row(13, 'rejected'), row(14, 'draft')];
  state.service_suggestion = [row(20), row(21, 'approved'), row(22, 'rejected')];
  state.report = [row(30), row(31, 'under_review'), row(32, 'evidence_requested'), row(33, 'resolved'), row(34, 'confirmed'),
    row(35, 'pending', { isCustomerNoShow: true }), row(36, 'pending', { createdViolationId: oid(999) })];
  await scanAutomaticSources();
  assert.deepEqual(state.assessments.map(item => item.sourceId), [10, 11, 20, 30, 31, 32].map(oid), 'Phải quét cả dữ liệu trước thời điểm bật.');
  assert(state.assessments.every(item => item.preview === false));
  await scanAutomaticSources();
  assert.equal(state.assessments.length, 6, 'Quét lại không được tạo tác vụ trùng.');
  state.service_suggestion[0].updatedAt = new Date('2026-11-05T00:00:00Z');
  await scanAutomaticSources();
  assert.equal(state.assessments.length, 7, 'Nguồn cập nhật sau con trỏ vẫn phải được quét.');

  reset();
  state.configs = [config('service_suggestion')];
  state.service_suggestion = Array.from({ length: 65 }, (_, index) => row(index + 1));
  for (let batch = 0; batch < 3; batch++) await scanAutomaticSources();
  assert.equal(state.assessments.length, 65, 'Phải quét hết dữ liệu tồn qua nhiều lô cùng thời điểm cập nhật.');
  assert.equal(new Set(state.assessments.map(item => item.sourceId)).size, 65);

  reset();
  state.configs = [config('service_suggestion', false)];
  state.service_suggestion = [row(1)];
  await scanAutomaticSources();
  assert.equal(state.assessments.length, 0, 'Tắt AI thì không tạo tác vụ.');
  state.configs[0].cursorAt = now;
  state.configs[0].cursorId = oid(99);
  await changeConfig('service_suggestion', oid(900), 1, { enabled: true });
  assert.equal(state.configs[0].cursorAt, null);
  await scanAutomaticSources();
  assert.equal(state.assessments.length, 1, 'Bật lại phải quét hồ sơ tồn trước con trỏ cũ.');
  await processNextAssessment();
  assert.equal(generated, 1, 'Nguồn còn chờ phải được chuyển tới bước phân tích AI.');
  assert.equal(state.assessments[0].status, 'manual');

  reset();
  state.configs = [config('provider_application')];
  state.configs[0].policy = { ...policy, applicationTypes: ['initial'] };
  state.provider_application = [row(1, 'pending', { applicationType: 'service_addition' }), row(2)];
  await scanAutomaticSources();
  assert.deepEqual(state.assessments.map(item => item.sourceId), [oid(2)], 'Giữ đúng phạm vi loại hồ sơ đã cấu hình.');
  assert.equal(state.configs[0].cursorId, oid(2), 'Hồ sơ ngoài phạm vi không được chặn con trỏ.');

  for (const [feature, sourceType, status] of [
    ['provider_application', 'provider_application', 'approved'], ['provider_application', 'provider_application', 'rejected'],
    ['service_suggestion', 'service_suggestion', 'approved'], ['service_suggestion', 'service_suggestion', 'rejected'],
    ['complaint_summary', 'report', 'resolved'], ['complaint_summary', 'report', 'confirmed'],
    ['complaint_summary', 'report', 'cancelled'], ['complaint_summary', 'complaint', 'resolved'],
  ]) {
    reset(); state.configs = [config(feature)]; state[sourceType] = [row(1, status)];
    for (const preview of [true, false]) {
      await assert.rejects(enqueueAssessment({ feature, sourceType, sourceId: oid(1), preview }, oid(900)), error => error.statusCode === 409);
    }
    assert.equal(state.assessments.length, 0, 'Không được tạo tác vụ bằng cách nhập mã nguồn đã xử lý.');
    state.assessments.push({ _id: oid(2), feature, sourceType, sourceId: oid(1), revision: 1, preview: false,
      sourceHash: JSON.stringify(state[sourceType][0]), policy, status: 'queued', attempts: 0, nextAt: old });
    await processNextAssessment();
    assert.equal(generated, 0, 'Nguồn kết thúc trong lúc chờ phải bị chặn trước khi gọi model.');
    assert.equal(state.assessments[0].status, 'stale');
  }
  reset();
  state.configs = [config('provider_application')];
  state.configs[0].policy = { ...policy, autoRejectIncompleteApplications: true };
  state.provider_application = [row(1, 'pending', { description: '   ', identityDocument: { type: 'cccd', frontImageUrl: 'anh-truoc' } })];
  let rejectionCalls = 0;
  dependencies['../../services/providerApplication.service'].reviewApplication = async (_admin, _id, decision) => {
    assert.equal(decision.status, 'rejected');
    assert.match(decision.rejectionNotes, /Chưa có mô tả/);
    assert.match(decision.rejectionNotes, /mặt sau/);
    rejectionCalls++;
  };
  await scanAutomaticSources();
  await processNextAssessment();
  assert.equal(generated, 0, 'Thiếu thông tin được kiểm tra trực tiếp, không phụ thuộc mô hình.');
  assert.equal(rejectionCalls, 1, 'Worker phải gọi luồng từ chối khi Admin đã cho phép.');
  assert.equal(state.assessments[0].model, null);
  assert(state.assessments[0].output.missingData.length === 2);
  console.log('Đạt: quét dữ liệu tồn, phân lô 65 bản ghi cùng thời điểm, không tạo trùng, tiếp tục đọc cập nhật, bật lại lấy tồn; chặn nguồn kết thúc; worker thiếu thông tin chỉ gọi luồng từ chối khi được cấp quyền, không gọi model.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
