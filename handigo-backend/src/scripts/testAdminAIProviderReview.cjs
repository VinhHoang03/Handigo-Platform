const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node/register/transpile-only');
const validation = require('../ai/admin/admin-ai.validation');
const criteria = require('../ai/admin/admin-ai.criteria');
const { AppError } = require('../utils/appError');

function load(relative, dependencies, extra = '') {
  const file = path.resolve(__dirname, relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Buffer, Date, AbortSignal,
    process: { env: { ADMIN_AI_API_KEY: 'khoa-gia-lap-kiem-thu' } },
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name) }, { filename: file });
  return exports;
}

async function run() {
  const policy = validation.policySchema.parse({ criteria: [
    { code: 'identity_images', kind: 'identity_images', required: true, description: 'Có đủ ảnh giấy tờ' },
    { code: 'relevance', kind: 'ai', required: true, description: 'Mô tả phù hợp dịch vụ' },
  ] });
  const description = 'Tôi sửa vòi nước "nhà bếp" và thay gioăng.\nKiểm tra kín nước sau sửa.';
  const sources = [{ id: 'provider_application:hoso', text: JSON.stringify({ description, services: [{ name: 'Sửa vòi nước nhà bếp' }] }) },
    { id: 'image:1', text: 'Mặt trước giấy tờ', imageUrl: 'https://anh-kiem-thu.invalid/front.png' }];
  const evidence = { sourceId: sources[0].id, quote: description };
  const output = validation.aiOutputSchema.parse({ summary: 'Mô tả phù hợp dịch vụ.',
    checks: [{ code: 'relevance', status: 'pass', reason: 'Có mô tả sửa vòi nước.', evidence: [evidence] }], evidence: [evidence],
    categoryId: null, normalizedName: null, normalizedDescription: null, duplicateServiceIds: [], classification: null, draftReply: null, timeline: [], missingData: [] });
  let requests = 0;
  let responseOutput = output;
  const provider = load('../ai/admin/admin-ai.provider.ts', {
    '../../utils/appError': { AppError }, '../../utils/logger': { createLogger: () => ({ warn() {} }) },
    '../llm/providers/provider-http': { postJson: async (_url, _headers, body) => {
      requests++;
      assert(body.systemInstruction.parts[0].text.includes('chỉ đánh giá mô tả'));
      return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(responseOutput) }] } }] };
    }, ProviderHttpError: class extends Error {} },
    './admin-ai.validation': validation,
    './admin-ai.images': { prepareAdminImages: async images => {
      assert.equal(images.length, responseOutput.complaintResolution ? 1 : 0, 'Hồ sơ thợ không cần gọi bộ phân tích ảnh.');
      return { images: [], ready: new Map(), unavailable: [], parts: [] };
    }, validateImageAnalyses: result => { assert.equal(result.imageAnalyses.length, 0); }, imagesNeedReview: () => false },
  });
  const generated = await provider.generateAdminAI('provider_application', policy, sources);
  assert.equal(requests, 1);
  assert.equal(generated.output.missingData.length, 0);
  provider.validateEvidence(output, sources, policy);
  assert.throws(() => provider.validateEvidence({ ...output, evidence: [{ ...evidence, quote: 'Tôi có chứng chỉ quốc tế chưa từng khai báo.' }] }, sources, policy), error => error.statusCode === 502);
  const complaintEvidence = { sourceId: 'report:kn01', quote: 'Vòi nước vẫn rỉ sau sửa.' };
  responseOutput = { ...output, evidence: [complaintEvidence], checks: [{ code: 'tu_them', status: 'pass', reason: 'Tiêu chí mô hình tự thêm.', evidence: [complaintEvidence] }], complaintResolution: {
    workflow: { category: 'service_quality', proposedStatus: 'under_review', allegations: ['Vòi nước vẫn rỉ sau sửa.'], facts: [],
      missingEvidence: [{ owner: 'reporter', description: 'Ảnh hiện trạng vòi nước.' }],
      tasks: [{ kind: 'verify', owner: 'admin', instruction: 'Đối chiếu hiện trạng và lời trình bày hai bên.', completionCondition: 'Có kết quả kiểm tra hiện trạng cụ thể.' }] },
    severity: 'LOW', severityReason: 'Chưa có thông tin thiệt hại nghiêm trọng.', disputed: false, evidenceStatus: 'insufficient', policyFindings: [],
    recommendation: 'Thu thập ảnh và xác minh với hai bên.', nextSteps: ['Thu thập ảnh hiện trạng.'], requiresAdminApproval: true, escalationReasons: [],
  } };
  const complaint = await provider.generateAdminAI('complaint_summary', validation.policySchema.parse({ criteria: [] }), [{ id: 'report:kn01', text: complaintEvidence.quote }]);
  assert.equal(complaint.output.checks.length, 0, 'Khiếu nại không có tiêu chí không bị lỗi do phần chấm điểm ngoài yêu cầu.');
  assert.equal(complaint.output.complaintResolution.workflow.tasks.length, 1);
  assert.equal(complaint.output.complaintResolution.requiresAdminApproval, true);
  const unverified = validation.aiOutputSchema.parse({ ...responseOutput, complaintResolution: {
    ...responseOutput.complaintResolution, evidenceStatus: 'sufficient',
    policyFindings: [{ sourceId: 'policy:missing', quote: 'Chính sách do mô hình tự tạo.', assessment: 'Đã áp dụng chính sách.', applicable: 'yes' }],
    workflow: { ...responseOutput.complaintResolution.workflow, proposedStatus: 'resolved',
      facts: [{ statement: 'Khách đã trả tiền theo lời phản ánh.', sourceIds: ['report:kn01'] },
        { statement: 'Đơn đã hoàn thành.', sourceIds: ['order:don'] }] },
  }, evidence: [complaintEvidence, { sourceId: 'order:don', quote: '"status":"completed"' }] });
  provider.prepareComplaintResolution(unverified, [{ id: 'report:kn01', text: complaintEvidence.quote }, { id: 'order:don', text: '{"status":"completed"}' }]);
  assert.equal(unverified.complaintResolution.workflow.facts.length, 1);
  assert.equal(unverified.complaintResolution.workflow.facts[0].sourceIds[0], 'order:don');
  assert.equal(unverified.complaintResolution.policyFindings.length, 0);
  assert.equal(unverified.complaintResolution.workflow.proposedStatus, 'under_review');
  assert.equal(unverified.complaintResolution.evidenceStatus, 'insufficient');
  assert(unverified.missingData.length > 0);
  assert(unverified.complaintResolution.workflow.missingEvidence.some(item => item.owner === 'admin'));
  const taskCount = unverified.complaintResolution.workflow.tasks.length;
  provider.prepareComplaintResolution(unverified, [{ id: 'report:kn01', text: complaintEvidence.quote }, { id: 'order:don', text: '{"status":"completed"}' }]);
  assert.equal(unverified.complaintResolution.workflow.tasks.length, taskCount, 'Chuẩn hóa lần hai không thêm việc lặp.');
  const intakeCalls = [];
  const complaintService = load('../ai/admin/admin-ai.complaint.ts', {
    './admin-ai.models': { AdminAIAssessment: { updateOne: async (_filter, update, options) => {
      assert.equal(options.runValidators, true);
      assert.equal(update.$set.status, 'manual');
    } } },
    './admin-ai.context': { loadContext: async () => ({ hash: 'sau-tiep-nhan' }) },
    '../../services/report.service': {
      reviewReport: async (_admin, _id, payload, automation) => {
        intakeCalls.push(payload);
        await automation.beforeWrite(null);
        await automation.afterWrite(null);
      },
      requestReportEvidence: async () => { throw Error('Không tự gửi yêu cầu bằng chứng từ phương án còn thiếu căn cứ.'); },
    },
  });
  const intakeOutcomes = [];
  const intake = await complaintService.applyComplaintAssessment({ _id: 'phan-tich', sourceType: 'report', sourceId: 'kn01', configuredBy: 'admin' },
    { status: 'pending' }, unverified, [], true, async (_session, outcome) => { intakeOutcomes.push(outcome); });
  assert.equal(intake, null);
  assert.equal(intakeCalls[0].status, 'under_review');
  assert.deepEqual(intakeOutcomes, ['auto_intake']);
  const quotedPolicy = validation.aiOutputSchema.parse({ ...responseOutput, complaintResolution: { ...responseOutput.complaintResolution,
    policyFindings: [{ sourceId: 'policy:term', quote: 'Nội dung "bảo hành".', assessment: 'Có nguồn để đối chiếu.', applicable: 'yes' }],
  } });
  provider.prepareComplaintResolution(quotedPolicy, [{ id: 'report:kn01', text: complaintEvidence.quote }, { id: 'policy:term', text: JSON.stringify({ rule: 'Nội dung "bảo hành".' }) }]);
  assert.equal(quotedPolicy.complaintResolution.policyFindings.length, 1, 'Giải mã dấu ngoặc kép trong nguồn JSON trước khi đối chiếu.');
  const goodResponse = responseOutput;
  responseOutput = { ...goodResponse, evidence: [{ sourceId: 'report:kn01', quote: 'x'.repeat(1100) }] };
  await assert.rejects(provider.generateAdminAI('complaint_summary', validation.policySchema.parse({ criteria: [] }), [{ id: 'report:kn01', text: complaintEvidence.quote }]), error => error.statusCode === 502 && /trích dẫn bằng chứng/.test(error.message));
  responseOutput = goodResponse;
  await assert.rejects(provider.generateAdminAI('complaint_summary', validation.policySchema.parse({ criteria: [
    { code: 'bat_buoc', kind: 'ai', required: true, description: 'Tiêu chí phải có kết quả' },
  ] }), [{ id: 'report:kn01', text: complaintEvidence.quote }]), error => error.statusCode === 502);
  responseOutput = output;
  console.log('Đạt: khiếu nại không có tiêu chí vẫn phân tích phương án; bỏ chấm điểm tự thêm, nhưng vẫn chặn thiếu tiêu chí được yêu cầu.');
  console.log('Đạt: loại dữ kiện và chính sách thiếu căn cứ, giữ dữ kiện có nguồn, chuyển xác minh thay vì thử lại; không kết luận vụ việc; trích dẫn chính sách có ký tự JSON được đối chiếu đúng, lỗi cấu trúc có thông báo cụ thể.');

  let approved = 0;
  const service = load('../ai/admin/admin-ai.service.ts', {
    '../../models/user.model': {}, '../../models/service.model': {}, '../../models/category.model': {},
    '../../services/providerApplication.service': { reviewApplication: async (_actor, _id, decision) => {
      assert.equal(decision.status, 'approved'); approved++;
    } }, '../../services/serviceSuggestion.service': {}, '../../utils/appError': { AppError },
    './admin-ai.models': {}, './admin-ai.validation': validation, './admin-ai.provider': provider,
    './admin-ai.context': {}, './admin-ai.criteria': criteria, './admin-ai.complaint': {},
  }, '\nexport { applyResult };');
  assert(!service.defaults('provider_application').criteria.some(rule => rule.kind === 'verified_identity'));
  const row = { status: 'pending', applicationType: 'initial', serviceIds: ['dich-vu'], description,
    identityDocument: { type: 'cccd', frontImageUrl: 'anh-truoc', backImageUrl: 'anh-sau' } };
  const job = { _id: 'tac-vu', configuredBy: 'admin', sourceId: 'hoso', sourceType: 'provider_application', feature: 'provider_application', policy, preview: false };
  const checks = source => [...criteria.evaluateCriteria(policy, source), ...output.checks];
  assert.equal(await service.applyResult(job, row, output, checks(row), true), null);
  assert.equal(approved, 1, 'Có ảnh và mô tả phù hợp phải gọi luồng duyệt hiện có.');
  const missingImage = { ...row, identityDocument: { type: 'cccd', frontImageUrl: 'anh-truoc' } };
  assert.equal((await service.applyResult(job, missingImage, output, checks(missingImage), true)).status, 'manual');
  assert.equal((await service.applyResult(job, row, output, [...criteria.evaluateCriteria(policy, row), { ...output.checks[0], status: 'fail' }], true)).status, 'manual');
  assert.equal((await service.applyResult(job, { ...row, status: 'approved' }, output, checks(row), true)).status, 'manual');
  assert.equal(approved, 1, 'Không duyệt hồ sơ thiếu ảnh, mô tả không phù hợp hoặc đã xử lý.');
  const noDescription = { ...row, description: '   ' };
  assert.equal((await service.applyResult(job, noDescription, output, checks(noDescription), true)).status, 'manual');
  assert.equal(validation.policySchema.parse({ instructions: 'Hãy tự từ chối hồ sơ thiếu thông tin.' }).autoRejectIncompleteApplications, false, 'Hướng dẫn văn bản không cấp quyền từ chối.');
  assert.throws(() => validation.policySchema.parse({ autoRejectIncompleteApplications: 'true' }));
  assert.equal(criteria.incompleteApplicationReasons({ ...row, identityDocument: { type: 'passport', passportImageUrl: 'anh-ho-chieu' } }).length, 0);
  assert.equal(criteria.incompleteApplicationReasons({ ...row, identityDocument: { type: 'passport', passportImageUrl: '  ' } }).length, 1);

  const rejectionPolicy = { ...policy, autoRejectIncompleteApplications: true };
  const rejectionJob = { ...job, policy: rejectionPolicy, sourceHash: 'ban-goc', leaseToken: 'quyen-xu-ly' };
  let liveConfig = { configuredBy: 'admin', policy: rejectionPolicy };
  let liveRow = missingImage, liveHash = 'ban-goc', adminActive = true, saved;
  const rejected = [];
  const rejectionService = load('../ai/admin/admin-ai.service.ts', {
    '../../models/user.model': { exists: () => ({ session: async () => adminActive }) },
    '../../models/service.model': {}, '../../models/category.model': {},
    '../../services/providerApplication.service': { reviewApplication: async (_actor, _id, decision, automation) => {
      await automation.beforeWrite(null);
      rejected.push(decision);
    } }, '../../services/serviceSuggestion.service': {}, '../../utils/appError': { AppError },
    './admin-ai.models': {
      AdminAIConfig: { findOneAndUpdate: async () => liveConfig },
      AdminAIAssessment: { updateOne: async (filter, update, options) => {
        assert.equal(filter.leaseToken, rejectionJob.leaseToken);
        assert.equal(options.runValidators, true);
        saved = update.$set;
        return { modifiedCount: 1 };
      } },
    }, './admin-ai.validation': validation, './admin-ai.provider': provider,
    './admin-ai.context': { loadContext: async () => ({ row: liveRow, hash: liveHash }) },
    './admin-ai.criteria': criteria, './admin-ai.complaint': {},
  }, '\nexport { applyResult };');
  assert.equal(await rejectionService.applyResult(rejectionJob, missingImage, output, checks(missingImage), true), null);
  assert.equal(rejected[0].status, 'rejected');
  assert.match(rejected[0].rejectionNotes, /mặt sau/);
  assert.equal(saved.outcome, 'auto_rejected');
  assert.equal(saved.status, 'completed');
  liveRow = noDescription;
  await rejectionService.applyResult(rejectionJob, noDescription, output, checks(noDescription), true);
  assert.match(rejected[1].rejectionNotes, /Chưa có mô tả/);
  const beforePreview = rejected.length;
  assert.equal((await rejectionService.applyResult({ ...rejectionJob, preview: true }, missingImage, output, checks(missingImage), true)).outcome, 'preview');
  assert.equal(rejected.length, beforePreview);
  assert.equal((await rejectionService.applyResult(rejectionJob, row, { ...output, missingData: ['Lỗi gọi AI'] }, checks(row), true)).status, 'manual');
  assert.equal(rejected.length, beforePreview, 'Lỗi mô hình hoặc thiếu dữ liệu AI không phải căn cứ tự từ chối.');
  liveRow = missingImage;
  for (const revoke of [
    () => { liveConfig = null; },
    () => { liveConfig = { configuredBy: 'admin', policy }; },
    () => { liveConfig = { configuredBy: 'admin', policy: rejectionPolicy }; adminActive = false; },
    () => { adminActive = true; liveHash = 'da-thay-doi'; },
    () => { liveHash = 'ban-goc'; liveRow = row; },
    () => { liveRow = { ...missingImage, status: 'rejected' }; },
  ]) {
    revoke();
    await assert.rejects(rejectionService.applyResult(rejectionJob, missingImage, output, checks(missingImage), true), error => error.statusCode === 409);
    assert.equal(rejected.length, beforePreview, 'Tắt quyền, đổi dữ liệu hoặc hồ sơ đã xử lý phải chặn ghi từ chối.');
  }
  console.log('Đạt: quyền tự từ chối mặc định tắt; văn bản không cấp quyền; bật mới từ chối khi thiếu ảnh/mô tả; hộ chiếu đúng loại; preview và lỗi AI không từ chối; kiểm tra lại quyền Admin, công tắc, dữ liệu và trạng thái trước khi ghi.');
  console.log('Đạt: chỉ kiểm tra ảnh đã nộp và mô tả phù hợp; không bắt phân tích ảnh; trích dẫn có dấu ngoặc kép/xuống dòng hợp lệ, bằng chứng bịa bị chặn; thiếu ảnh, sai mô tả và hồ sơ kết thúc không tự duyệt.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
