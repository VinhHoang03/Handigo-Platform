// Đưa đúng dữ liệu mẫu đã tạo vào diện quét sau khi Admin bật công tắc.
// Không bật cấu hình, tạo assessment hoặc gọi worker/model thay cho backend.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { ProviderApplication } = require('../models/providerApplication.model');
const { ServiceSuggestion } = require('../models/serviceSuggestion.model');
const { Report } = require('../models/report.model');
const { AdminAIConfig, AdminAIAssessment } = require('../ai/admin/admin-ai.models');

const id = code => createHash('sha256').update(`handigo-admin-ai-test-v1:${code}`).digest('hex').slice(0, 24);
const groups = [
  { feature: 'provider_application', model: ProviderApplication, codes: ['HS01', 'HS02', 'HS03', 'HS04'] },
  { feature: 'service_suggestion', model: ServiceSuggestion, codes: ['DV01', 'DV02', 'DV03', 'DV04', 'DV05', 'DV06'] },
  { feature: 'complaint_summary', model: Report, codes: ['KN01', 'KN02', 'KN03', 'KN04', 'KN05', 'KN06', 'KN07'] },
];
const armed = new Set();
const selectedCases = groups.flatMap(group => group.codes.map(code => ({ code, sourceId: id(code), feature: group.feature })));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function arm(group, config) {
  const session = await mongoose.startSession();
  let changed = 0;
  try {
    await session.withTransaction(async () => {
      changed = 0;
      const current = await AdminAIConfig.findOne({ _id: config._id, enabled: true, revision: config.revision }).session(session).lean();
      assert(current, 'Cấu hình vừa thay đổi; cần chạy lại theo công tắc hiện tại.');
      const updatedAt = new Date();
      assert(updatedAt > (current.cursorAt || current.enabledSince || new Date(0)), 'Chưa vượt mốc quét; hãy thử lại sau.');
      for (const code of group.codes) {
        const row = await group.model.findById(id(code)).session(session);
        assert(row && !row.isDeleted, `Thiếu dữ liệu mẫu ${code}.`);
        assert(String(row.description || '').includes('[TEST AI ADMIN]') || String(row.adminNote || '').includes('[TEST AI ADMIN]'), 'Tài nguyên không có nhãn dữ liệu thử.');
        const existing = await AdminAIAssessment.exists({ sourceId: String(row._id), feature: group.feature, preview: false }).session(session);
        if (existing || !['pending', 'resubmitted', 'evidence_requested'].includes(row.status)) continue;
        await group.model.updateOne({ _id: row._id, updatedAt: row.updatedAt, status: row.status },
          { $set: { updatedAt } }, { session, timestamps: false, runValidators: true });
        changed++;
      }
    });
  } finally { await session.endSession(); }
  console.log(JSON.stringify({ event: 'đã đưa dữ liệu mẫu vào diện quét', feature: group.feature, changed,
    note: 'Chờ backend tự tạo và xử lý tác vụ; script không gọi chạy thử/xử lý thật.' }));
}

async function snapshot() {
  const configs = await AdminAIConfig.find({ feature: { $in: groups.map(group => group.feature) } }).select('feature enabled revision').lean();
  const jobs = await AdminAIAssessment.find({ sourceId: { $in: selectedCases.map(row => row.sourceId) }, preview: false })
    .select('feature sourceId status outcome error model attempts createdAt').sort({ createdAt: -1 }).lean();
  const sources = new Map();
  for (const group of groups) {
    const rows = await group.model.find({ _id: { $in: group.codes.map(id) } })
      .select('status reviewSource aiAssessmentId createdServiceId reviewedByType requestedEvidenceNote').lean();
    for (const row of rows) sources.set(String(row._id), row);
  }
  const cases = selectedCases.map(testCase => {
    const job = jobs.find(row => row.sourceId === testCase.sourceId && row.feature === testCase.feature);
    const row = sources.get(testCase.sourceId);
    return { code: testCase.code, sourceId: testCase.sourceId, feature: testCase.feature,
      sourceStatus: row?.status || 'không tìm thấy', assessmentStatus: job?.status || 'chưa có tác vụ tự động',
      outcome: job?.outcome || null, model: job?.model || null, error: job?.error || null,
      ...(row?.createdServiceId ? { createdServiceId: String(row.createdServiceId) } : {}) };
  });
  return { configs, cases };
}

async function main() {
  const mode = process.argv[2];
  assert(['--watch', '--status'].includes(mode), 'Dùng --watch hoặc --status.');
  assert(process.env.HANDIGO_AI_SEED_URI, 'Chưa cấp HANDIGO_AI_SEED_URI qua môi trường tiến trình.');
  await mongoose.connect(process.env.HANDIGO_AI_SEED_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  assert.equal(mongoose.connection.name, 'FixNow', 'Sai database đích.');
  if (mode === '--status') { console.log(JSON.stringify(await snapshot(), null, 2)); return; }
  const seconds = Number(process.argv[3] || 600);
  assert(Number.isFinite(seconds) && seconds >= 15 && seconds <= 1800, 'Thời gian theo dõi từ 15 đến 1800 giây.');
  const deadline = Date.now() + seconds * 1000;
  let previous = '';
  let heartbeat = 0;
  while (Date.now() < deadline) {
    for (const group of groups) {
      if (armed.has(group.feature)) continue;
      const config = await AdminAIConfig.findOne({ feature: group.feature, enabled: true }).lean();
      if (!config) continue;
      await arm(group, config);
      armed.add(group.feature);
    }
    const state = await snapshot();
    const serialized = JSON.stringify(state);
    if (serialized !== previous || Date.now() - heartbeat >= 30000) {
      console.log(JSON.stringify({ event: 'trạng thái tự động', armed: [...armed], ...state }));
      previous = serialized; heartbeat = Date.now();
    }
    if (armed.size === groups.length && state.cases.every(row => ['completed', 'manual', 'stale', 'error'].includes(row.assessmentStatus))) {
      console.log(JSON.stringify({ event: 'đã có kết quả cho toàn bộ ca tự động', note: 'Cần đối chiếu outcome và dữ liệu nguồn với kỳ vọng; manual không tự động đồng nghĩa thất bại.' }));
      return;
    }
    await wait(5000);
  }
  console.log(JSON.stringify({ event: 'kết thúc thời gian theo dõi', armed: [...armed], ...(await snapshot()) }));
}

main().catch(error => {
  console.error(JSON.stringify({ error: 'Không hoàn tất theo dõi AI tự động.', name: error.name,
    detail: error.name === 'AssertionError' ? error.message : 'Kiểm tra kết nối và backend; không in thông tin xác thực.' }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
