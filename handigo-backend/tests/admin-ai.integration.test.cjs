const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
const { MongoMemoryReplSet } = require(path.join(process.env.ADMIN_AI_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-admin-ai-test-runtime'), 'node_modules/mongodb-memory-server'));
const mongoose = require('mongoose');
const provider = require('../src/ai/admin/admin-ai.provider');
const service = require('../src/ai/admin/admin-ai.service');
const models = require('../src/ai/admin/admin-ai.models');
const { policySchema } = require('../src/ai/admin/admin-ai.validation');
const { ProviderApplication } = require('../src/models/providerApplication.model');
const { Provider } = require('../src/models/provider.model');
const { ServiceSuggestion } = require('../src/models/serviceSuggestion.model');
const { Service } = require('../src/models/service.model');
const { Category } = require('../src/models/category.model');
const { Session } = require('../src/models/session.model');
const { Notification } = require('../src/models/notification.model');
const { SupportTicket } = require('../src/models/supportTicket.model');
const { Report } = require('../src/models/report.model');
const User = require('../src/models/user.model').default;
const { AppError } = require('../src/utils/appError');
let sequence = 0;
const policy = () => policySchema.parse({ criteria: [
  { code: 'description', kind: 'description_length', value: 10, description: 'Mô tả ít nhất mười ký tự', required: true },
  { code: 'relevance', kind: 'ai', description: 'Mô tả phù hợp dịch vụ đăng ký', required: true },
] });
async function fixture() {
  const admin = await User.create({ email: `admin${++sequence}@example.test`, fullName: 'Nguyễn Văn An', role: 'ADMIN', status: 'active' });
  const customer = await User.create({ email: `user${sequence}@example.test`, fullName: 'Trần Văn Bình', role: 'CUSTOMER', status: 'active' });
  const category = await Category.create({ name: 'Gia dụng', slug: `gia-dung-${sequence}`, isActive: true });
  const catalog = await Service.create({ categoryId: category._id, name: 'Sửa điện dân dụng', slug: `sua-dien-${sequence}`, serviceType: 'variable_price', depositAmount: 50000, isActive: true });
  const application = await ProviderApplication.create({ userId: customer._id, applicationType: 'initial', status: 'pending', description: 'Có kinh nghiệm sửa điện dân dụng nhiều năm', experienceYears: 3, serviceIds: [catalog._id], certificates: [], identityDocument: { type: 'cccd', frontImageUrl: 'https://example.test/front.png', backImageUrl: 'https://example.test/back.png' } });
  return { admin, customer, category, catalog, application };
}
async function configure(feature, adminId, customPolicy = policy()) {
  const config = await models.AdminAIConfig.findOne({ feature });
  const saved = await service.changeConfig(feature, String(adminId), config.revision, { draft: customPolicy });
  return service.changeConfig(feature, String(adminId), saved.revision, { enabled: true });
}
const input = (f, preview = false) => ({ feature: 'provider_application', sourceType: 'provider_application', sourceId: String(f.application._id), preview });
async function complaintFixture(st, options = {}) {
  const f = await fixture();
  const { Order } = require('../src/models/order.model');
  const orderId = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({ _id: orderId, customerId: f.customer._id, orderCode: 'HD-KHIEU-NAI', status: 'completed', paymentStatus: 'paid', isDeleted: false });
  const report = await Report.create({ reporterId: f.customer._id, reporterRole: 'CUSTOMER', orderId, targetType: 'order', reportType: 'service_quality', title: 'Cần kiểm tra công việc', description: 'Người gửi yêu cầu đối chiếu thông tin thực hiện.', ...(options.report || {}) });
  if (options.before) await options.before({ ...f, orderId, report });
  await configure('complaint_summary', f.admin._id, policySchema.parse({}));
  mockAI(st, async (output, sources) => {
    const order = sources.find(source => source.id.startsWith('order:')) || sources.find(source => source.id.startsWith('report:'));
    const policy = sources.find(source => source.id.startsWith('policy:') && source.id !== 'policy:warranty');
    output.evidence = [{ sourceId: order.id, quote: order.text.slice(0, 40) }];
    output.complaintResolution = {
      severity: 'LOW', severityReason: 'Cần đối chiếu thông tin.', disputed: false, evidenceStatus: 'sufficient',
      policyFindings: [{ sourceId: policy.id, quote: policy.text.slice(0, 60), assessment: 'Đối chiếu chính sách hiện có.', applicable: 'yes' }],
      recommendation: 'Admin xác minh kết quả và quyết định theo phương án.', nextSteps: ['Kiểm tra dữ kiện và thực hiện các công việc.'],
      requiresAdminApproval: false, escalationReasons: [], action: 'resolve', resolutionNote: 'Dự thảo kết quả đối chiếu, chưa áp dụng.', pendingActions: [],
      ...(options.resolution || {}),
      workflow: { category: 'payment', proposedStatus: 'under_review', allegations: ['Người gửi cần đối chiếu dữ liệu.'],
        facts: order.id.startsWith('order:') ? [{ statement: 'Đơn dịch vụ đã hoàn thành.', sourceIds: [order.id] }] : [], missingEvidence: [],
        tasks: [{ kind: 'verify', owner: 'admin', instruction: 'Đối chiếu đúng giao dịch và đơn.', completionCondition: 'Có kết quả xác minh trạng thái và số tiền.' }], ...(options.workflow || {}) },
    };
    if (options.mutate) await options.mutate(output, sources);
  });
  const job = await service.enqueueAssessment({ feature: 'complaint_summary', sourceType: 'report', sourceId: String(report._id), preview: Boolean(options.preview) }, String(f.admin._id));
  await service.processNextAssessment();
  return { ...f, orderId, report, job: await models.AdminAIAssessment.findById(job._id) };
}
function mockAI(t, mutate) {
  t.mock.method(provider, 'generateAdminAI', async (feature, policy, sources) => {
    const evidence = [{ sourceId: sources[0].id, quote: sources[0].text.slice(0, 50) }];
    const output = { summary: 'Đã đối chiếu dữ liệu theo bộ tiêu chí.', checks: policy.criteria.filter(rule => rule.kind === 'ai').map(rule => ({ code: rule.code, status: 'pass', reason: 'Có dữ liệu phù hợp.', evidence })), evidence, categoryId: sources.find(item => item.id.startsWith('category:'))?.id.slice(9) || null, normalizedName: null, normalizedDescription: null, duplicateServiceIds: [], classification: feature === 'support_classification' ? { category: 'PAYMENT', priority: 'HIGH' } : null, draftReply: 'Vui lòng kiểm tra thông tin và bổ sung bằng chứng.', timeline: [], missingData: [] };
    if (mutate) await mutate(output, sources);
    return { output, model: 'mo-hinh-kiem-thu', usage: { inputTokens: 20, outputTokens: 30 } };
  });
}

test('AI admin với MongoDB replica set cô lập, transaction thật và API thật', { timeout: 240000 }, async t => {
  const fakePaymentConfig = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
  const previousPaymentConfig = fakePaymentConfig.map(key => process.env[key]);
  fakePaymentConfig.forEach(key => { process.env[key] = 'gia-lap-khong-goi-cong-thanh-toan'; });
  t.after(() => fakePaymentConfig.forEach((key, i) => { if (previousPaymentConfig[i] === undefined) delete process.env[key]; else process.env[key] = previousPaymentConfig[i]; }));
  const previousKey = process.env.ADMIN_AI_API_KEY;
  process.env.ADMIN_AI_API_KEY = 'khoa-gia-lap-khong-goi-nha-cung-cap';
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  t.after(async () => { await mongoose.disconnect(); await replica.stop(); if (previousKey === undefined) delete process.env.ADMIN_AI_API_KEY; else process.env.ADMIN_AI_API_KEY = previousKey; });
  await mongoose.connect(replica.getUri(), { dbName: 'handigo_admin_ai_test' });
  await Promise.all([ProviderApplication, Provider, ServiceSuggestion, Service, Category, Session, Notification, SupportTicket, Report, User].map(model => model.init()));
  await service.initializeAdminAI();
  const clean = async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); await service.initializeAdminAI(); };

  await t.test('Tắt mặc định, khóa riêng và cấu hình phiên bản có lịch sử', async () => {
    const f = await fixture();
    assert((await service.listConfigs()).configs.every(item => !item.enabled));
    await assert.rejects(service.enqueueAssessment(input(f), String(f.admin._id)), error => error.statusCode === 409);
    const cfg = await configure('provider_application', f.admin._id);
    assert.equal(cfg.enabled, true);
    await assert.rejects(service.changeConfig('provider_application', String(f.admin._id), 0, { enabled: false }), error => error.statusCode === 409);
    assert.equal(await models.AdminAIConfigHistory.countDocuments(), 2);
  });
  await clean();
  await t.test('Không bật tự duyệt khi nguồn xác minh danh tính bắt buộc chưa sẵn sàng', async () => {
    const f = await fixture();
    const custom = policy();
    custom.criteria.push({ code: 'independent_identity', kind: 'verified_identity', description: 'Xác minh danh tính độc lập', required: true, value: 0 });
    const saved = await service.changeConfig('provider_application', String(f.admin._id), 0, { draft: custom });
    await assert.rejects(service.changeConfig('provider_application', String(f.admin._id), saved.revision, { enabled: true }), error => error.statusCode === 422);
    assert.equal((await models.AdminAIConfig.findOne({ feature: 'provider_application' })).enabled, false);
  });
  await clean();
  await t.test('Tự duyệt đăng ký ban đầu tạo provider, đổi quyền, thu hồi phiên và một thông báo', async st => {
    const f = await fixture(); mockAI(st);
    await configure('provider_application', f.admin._id);
    await Session.create({ userId: f.customer._id, refreshTokenHash: 'gia-lap', expiresAt: new Date(Date.now() + 3600000) });
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    await service.processNextAssessment();
    const result = await models.AdminAIAssessment.findById(job._id);
    assert.equal(result.status, 'completed', result.error); assert.equal(result.outcome, 'auto_approved');
    assert.equal((await User.findById(f.customer._id)).role, 'PROVIDER');
    const application = await ProviderApplication.findById(f.application._id);
    assert.equal(application.reviewedBy, null); assert.equal(application.reviewSource, 'ai'); assert.equal(application.reviewHistory[0].actorType, 'system');
    assert.equal(application.reviewHistory[0].actorId, null); assert.equal(await Provider.countDocuments(), 1);
    assert((await Session.findOne()).revokedAt); assert.equal(await Notification.countDocuments({ userId: f.customer._id }), 1);
    assert.equal(await service.processNextAssessment(), false);
  });
  for (const scenario of ['missing', 'ai_unknown', 'disabled_during_ai', 'criteria_changed', 'source_changed', 'admin_reviewed', 'owner_locked', 'admin_locked']) {
    await clean();
    await t.test(`Không tự duyệt trường hợp ${scenario}`, async st => {
      const f = await fixture(); const cfg = await configure('provider_application', f.admin._id);
      if (scenario === 'missing') await ProviderApplication.updateOne({ _id: f.application._id }, { description: 'Ngắn' });
      mockAI(st, async output => {
        if (scenario === 'ai_unknown') output.checks[0].status = 'unknown';
        if (scenario === 'disabled_during_ai') await service.changeConfig('provider_application', String(f.admin._id), cfg.revision, { enabled: false });
        if (scenario === 'criteria_changed') await service.changeConfig('provider_application', String(f.admin._id), cfg.revision, { draft: policy() });
        if (scenario === 'source_changed') await ProviderApplication.updateOne({ _id: f.application._id }, { description: 'Hồ sơ sửa trong lúc đang phân tích' });
        if (scenario === 'admin_reviewed') await require('../src/services/providerApplication.service').reviewApplication(String(f.admin._id), String(f.application._id), { status: 'approved' });
        if (scenario === 'owner_locked') await User.updateOne({ _id: f.customer._id }, { status: 'locked' });
        if (scenario === 'admin_locked') await User.updateOne({ _id: f.admin._id }, { status: 'locked' });
      });
      const job = await service.enqueueAssessment(input(f), String(f.admin._id)); await service.processNextAssessment();
      const result = await models.AdminAIAssessment.findById(job._id);
      assert(['manual', 'stale'].includes(result.status), result.error || result.status);
      assert.equal(await Provider.countDocuments(), scenario === 'admin_reviewed' ? 1 : 0);
      assert.equal(await Notification.countDocuments({ userId: f.customer._id }), scenario === 'admin_reviewed' ? 1 : 0);
    });
  }
  await clean();
  await t.test('Phân tích thử không cấp quyền và không gửi thông báo', async st => {
    const f = await fixture(); mockAI(st);
    const cfg = await models.AdminAIConfig.findOne({ feature: 'provider_application' });
    await service.changeConfig('provider_application', String(f.admin._id), cfg.revision, { draft: policy() });
    const job = await service.enqueueAssessment(input(f, true), String(f.admin._id)); await service.processNextAssessment();
    assert.equal((await models.AdminAIAssessment.findById(job._id)).outcome, 'preview'); assert.equal(await Provider.countDocuments(), 0); assert.equal(await Notification.countDocuments(), 0);
  });
  await clean();
  await t.test('Hai worker và hai yêu cầu giống nhau chỉ duyệt một lần', async st => {
    const f = await fixture(); mockAI(st); await configure('provider_application', f.admin._id);
    const jobs = await Promise.all([service.enqueueAssessment(input(f), String(f.admin._id)), service.enqueueAssessment(input(f), String(f.admin._id))]);
    assert.equal(String(jobs[0]._id), String(jobs[1]._id));
    await Promise.all([service.processNextAssessment(), service.processNextAssessment()]);
    assert.equal(await Provider.countDocuments(), 1); assert.equal(await Notification.countDocuments(), 1);
  });
  await clean();
  await t.test('Bổ sung dịch vụ giữ quyền và thêm dịch vụ, không tạo provider thứ hai', async st => {
    const f = await fixture(); mockAI(st); await User.updateOne({ _id: f.customer._id }, { role: 'PROVIDER' });
    await Provider.create({ userId: f.customer._id, description: 'Thợ hiện có', experienceYears: 1, serviceIds: [] });
    await ProviderApplication.updateOne({ _id: f.application._id }, { applicationType: 'service_addition' });
    await configure('provider_application', f.admin._id); await service.enqueueAssessment(input(f), String(f.admin._id)); await service.processNextAssessment();
    assert.equal(await Provider.countDocuments(), 1); assert.equal((await Provider.findOne()).serviceIds.length, 1); assert.equal((await User.findById(f.customer._id)).role, 'PROVIDER');
  });
  await clean();
  await t.test('Rollback khi thông báo không ghi được: không có quyền hoặc provider cập nhật một phần', async st => {
    const f = await fixture(); mockAI(st); await configure('provider_application', f.admin._id);
    st.mock.method(require('../src/services/notification.service'), 'createNotificationRecord', async () => { throw new Error('Lỗi ghi thông báo giả lập'); });
    const job = await service.enqueueAssessment(input(f), String(f.admin._id)); await service.processNextAssessment();
    assert.equal((await ProviderApplication.findById(f.application._id)).status, 'pending'); assert.equal((await User.findById(f.customer._id)).role, 'CUSTOMER'); assert.equal(await Provider.countDocuments(), 0); assert.equal((await models.AdminAIAssessment.findById(job._id)).status, 'retry');
  });
  for (const scenario of ['approved', 'semantic_duplicate', 'category_suggestion', 'catalog_changed']) {
    await clean();
    await t.test(`Gợi ý dịch vụ: ${scenario}`, async st => {
      const f = await fixture(); const worker = await Provider.create({ userId: f.customer._id, description: 'Thợ', experienceYears: 1, serviceIds: [] });
      const suggestion = await ServiceSuggestion.create({ providerId: worker._id, suggestionType: scenario === 'category_suggestion' ? 'category' : 'service', suggestedServiceName: 'Sửa cửa gỗ tại nhà', suggestedCategoryName: 'Dịch vụ mới', categoryId: f.category._id, description: 'Sửa chữa bản lề, ổ khóa và cánh cửa gỗ tại nhà' });
      mockAI(st, async output => { if (scenario === 'semantic_duplicate') output.duplicateServiceIds = [String(f.catalog._id)]; if (scenario === 'catalog_changed') await Category.updateOne({ _id: f.category._id }, { isActive: false }); });
      await configure('service_suggestion', f.admin._id);
      const job = await service.enqueueAssessment({ feature: 'service_suggestion', sourceType: 'service_suggestion', sourceId: String(suggestion._id), preview: false }, String(f.admin._id)); await service.processNextAssessment();
      const result = await models.AdminAIAssessment.findById(job._id);
      assert.equal(result.status, scenario === 'approved' ? 'completed' : scenario === 'catalog_changed' ? 'stale' : 'manual', result.error);
      if (scenario === 'approved') { const created = await Service.findOne({ name: 'Sửa cửa gỗ tại nhà' }); assert(created); assert.equal(created.isActive, false); assert.equal((await ServiceSuggestion.findById(suggestion._id)).reviewedBy, null); }
      else assert.equal(await Service.countDocuments(), 1);
      assert.equal(await Category.countDocuments(), 1);
    });
  }
  await clean();
  await t.test('Ngừng AI phân loại: chặn cấu hình, quét và tác vụ cũ', async st => {
    const f = await fixture();
    const ai = st.mock.method(provider, 'generateAdminAI', async () => { throw new Error('AI không được gọi'); });
    const feature = 'support_classification';
    const { featureSchema, runSchema } = require('../src/ai/admin/admin-ai.validation');
    assert.equal(featureSchema.safeParse(feature).success, false);
    const ticket = await SupportTicket.create({ requesterId: f.customer._id, category: 'OTHER', subject: 'Hỗ trợ thanh toán', description: 'Kiểm tra giao dịch thanh toán' });
    const request = { feature, sourceType: 'support_ticket', sourceId: String(ticket._id), preview: false };
    assert.equal(runSchema.safeParse(request).success, false);
    assert.equal(await models.AdminAIConfig.countDocuments({ feature }), 0);
    await models.AdminAIConfig.create({ feature, enabled: true, revision: 1, draft: policySchema.parse({}), policy: policySchema.parse({}), configuredBy: f.admin._id, enabledSince: new Date(0) });
    assert(!(await service.listConfigs()).configs.some(config => config.feature === feature));
    await assert.rejects(service.changeConfig(feature, String(f.admin._id), 1, { enabled: true }), error => error.statusCode === 410);
    for (const preview of [true, false]) await assert.rejects(service.enqueueAssessment({ ...request, preview }, String(f.admin._id)), error => error.statusCode === 410);
    await service.scanAutomaticSources();
    assert.equal(await models.AdminAIAssessment.countDocuments({ feature }), 0);
    const job = await models.AdminAIAssessment.create({ key: 'legacy-classification', feature, sourceType: 'support_ticket', sourceId: String(ticket._id), revision: 1, policy: policySchema.parse({}), sourceHash: 'legacy', preview: false, configuredBy: f.admin._id });
    await service.processNextAssessment();
    assert.equal((await models.AdminAIAssessment.findById(job._id)).status, 'error');
    assert.equal(ai.mock.callCount(), 0);
    const corrections = require('../src/ai/admin/admin-ai.classification');
    await assert.rejects(corrections.correctClassification(String(job._id), String(f.admin._id), { category: 'PAYMENT', priority: 'HIGH' }), error => error.statusCode === 410);
    assert.equal((await SupportTicket.findById(ticket._id)).category, 'OTHER');
  });
  await clean();
  await t.test('Quét cả hồ sơ tồn khi bật và đi qua nhiều trang cùng mốc thời gian', async () => {
    const f = await fixture();
    await ServiceSuggestion.create({ providerId: new mongoose.Types.ObjectId(), suggestionType: 'service', suggestedServiceName: 'Hồ sơ tồn', description: 'Mô tả dịch vụ tồn trước thời điểm bật' });
    await configure('service_suggestion', f.admin._id);
    await service.scanAutomaticSources(); assert.equal(await models.AdminAIAssessment.countDocuments(), 1);
    const stamp = new Date(Date.now() + 10);
    await ServiceSuggestion.collection.insertMany(Array.from({ length: 35 }, (_, index) => ({ providerId: new mongoose.Types.ObjectId(), suggestionType: 'service', suggestedServiceName: `Dịch vụ ${index}`, description: 'Mô tả dịch vụ đủ dữ liệu để chạy phân tích', status: 'pending', isDeleted: false, createdAt: stamp, updatedAt: stamp })));
    await service.scanAutomaticSources(); await service.scanAutomaticSources(); await service.scanAutomaticSources();
    assert.equal(await models.AdminAIAssessment.countDocuments(), 36);
  });
  await clean();
  await t.test('Khôi phục tác vụ sau khi lease của worker cũ hết hạn', async st => {
    const f = await fixture(); mockAI(st); await configure('provider_application', f.admin._id);
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    await models.AdminAIAssessment.updateOne({ _id: job._id }, { status: 'running', leaseToken: 'worker-cu', leaseUntil: new Date(0), attempts: 1 });
    await service.processNextAssessment();
    const result = await models.AdminAIAssessment.findById(job._id); assert.equal(result.status, 'completed', result.error); assert.equal(result.attempts, 2); assert.equal(await Provider.countDocuments(), 1);
  });
  await clean();
  for (const scenario of ['resolved', 'image_resolved', 'preview', 'disputed', 'missing', 'refund', 'unreadable', 'pdf', 'source_changed', 'config_disabled', 'admin_handled', 'duplicate', 'rollback']) {
    await t.test(`Tiếp nhận khiếu nại, không tự đóng và điều kiện chặn: ${scenario}`, async st => {
      const f = await fixture();
      const { Order } = require('../src/models/order.model');
      const orderId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({ _id: orderId, orderCode: 'HD-DOI-CHIEU', status: 'completed', paymentStatus: 'paid', isDeleted: false });
      const report = await Report.create({ reporterId: f.customer._id, orderId, targetType: 'order', reportType: 'service_quality', title: 'Đối chiếu khoản thanh toán', description: 'Khách muốn làm rõ khoản thanh toán đã ghi nhận.', ...(scenario === 'pdf' ? { evidenceFiles: [{ fileType: 'file', url: 'https://example.test/hoa-don.pdf' }] } : {}) });
      if (scenario === 'image_resolved') await Report.updateOne({ _id: report._id }, { evidenceImages: ['https://res.cloudinary.com/handigo-kiem-thu/image/upload/v1/handigo/order-attachments/anh.png'] });
      const cfg = await configure('complaint_summary', f.admin._id, policySchema.parse({}));
      mockAI(st, async (output, sources) => {
        const orderSource = sources.find(source => source.id.startsWith('order:'));
        const policySource = sources.find(source => source.id.startsWith('policy:') && source.id !== 'policy:warranty');
        output.evidence = [{ sourceId: orderSource.id, quote: orderSource.text.slice(0, 40) }];
        output.imageAnalyses = scenario === 'unreadable' ? [{ sourceId: 'image:1', status: 'unreadable', relevant: true, consistent: false, observations: [], uncertainties: ['Ảnh bị mờ.'] }] : [];
        if (scenario === 'image_resolved') output.imageAnalyses = sources.filter(source => source.imageUrl).map(source => ({ sourceId: source.id, status: 'analyzed', relevant: true, consistent: true, observations: ['Nội dung hóa đơn phù hợp dữ kiện trên đơn.'], uncertainties: [] }));
        output.complaintResolution = { severity: 'LOW', severityReason: 'Chỉ cần đối chiếu dữ liệu.', disputed: scenario === 'disputed', evidenceStatus: scenario === 'missing' ? 'insufficient' : 'sufficient', policyFindings: [{ sourceId: policySource.id, quote: policySource.text.slice(0, 80), assessment: 'Đối chiếu dữ kiện đã ghi nhận.', applicable: 'yes' }], recommendation: 'Đã làm rõ dữ liệu, không còn yêu cầu thực thi.', nextSteps: ['Xem kết luận trên khiếu nại.'], requiresAdminApproval: false, escalationReasons: [], action: 'resolve', resolutionNote: 'Đã đối chiếu và làm rõ khoản thanh toán trong đơn hàng.', pendingActions: scenario === 'refund' ? ['refund'] : [] };
        output.complaintResolution.workflow = { category: 'payment', proposedStatus: 'resolved', allegations: ['Khách cần đối chiếu giao dịch.'], facts: [{ statement: 'Đơn đã ghi nhận thanh toán.', sourceIds: [orderSource.id] }], missingEvidence: [], tasks: [{ kind: 'verify', owner: 'admin', instruction: 'Đối chiếu giao dịch đúng đơn.', completionCondition: 'Có kết quả đối chiếu số tiền và trạng thái.' }] };
        if (scenario === 'source_changed') await Report.updateOne({ _id: report._id }, { description: 'Người gửi bổ sung nội dung trong lúc AI đang đọc.' });
        if (scenario === 'config_disabled') await service.changeConfig('complaint_summary', String(f.admin._id), cfg.revision, { enabled: false });
        if (scenario === 'admin_handled') await Report.updateOne({ _id: report._id }, { status: 'resolved', resolutionNote: 'Admin đã xử lý trước.' });
      });
      const request = { feature: 'complaint_summary', sourceType: 'report', sourceId: String(report._id), preview: scenario === 'preview' };
      const job = await service.enqueueAssessment(request, String(f.admin._id));
      if (scenario === 'rollback') st.mock.method(Report.prototype, 'save', async () => { throw new Error('Lỗi ghi kết luận giả lập'); });
      if (scenario === 'duplicate') assert.equal(String((await service.enqueueAssessment(request, String(f.admin._id)))._id), String(job._id));
      await Promise.all([service.processNextAssessment(), service.processNextAssessment()]);
      const result = await models.AdminAIAssessment.findById(job._id);
      const updated = await Report.findById(report._id);
      if (['resolved', 'image_resolved', 'duplicate'].includes(scenario)) {
        assert.equal(result.outcome, 'auto_intake', result.error); assert.equal(updated.status, 'under_review');
        assert.equal(updated.reviewedByType, 'system'); assert.equal(updated.reviewedBy, null); assert.equal(updated.handledBy, null);
        assert(updated.reviewNote.includes(String(job._id))); assert.equal(updated.handledAt, null); assert.equal(updated.resolutionNote, null);
      } else if (scenario === 'preview') { assert.equal(result.outcome, 'preview'); assert.equal(updated.status, 'pending'); }
      else if (scenario === 'rollback') { assert.equal(result.status, 'retry'); assert.equal(updated.status, 'pending'); assert.equal(updated.reviewedByType, null); }
      else if (['source_changed', 'config_disabled', 'admin_handled'].includes(scenario)) {
        assert.equal(result.status, 'stale', result.error);
        assert.equal(updated.resolutionNote, scenario === 'admin_handled' ? 'Admin đã xử lý trước.' : null);
      } else { assert.equal(result.status, 'manual', result.error); assert.equal(updated.status, 'under_review'); }
      assert.equal(await Notification.countDocuments(), 0);
    });
    await clean();
  }
  await t.test('Khiếu nại thiếu căn cứ chuyển Admin và không tự xử phạt hoặc gửi thông báo', async st => {
    const f = await fixture(); mockAI(st);
    const report = await Report.create({ reporterId: f.customer._id, targetType: 'system', reportType: 'other', title: 'Cần kiểm tra dịch vụ', description: 'Người gửi cho rằng dịch vụ chưa hoàn thành' });
    for (const feature of ['complaint_summary']) {
      await configure(feature, f.admin._id, policySchema.parse({}));
      await service.enqueueAssessment({ feature, sourceType: 'report', sourceId: String(report._id), preview: false }, String(f.admin._id)); await service.processNextAssessment();
    }
    assert.equal((await Report.findById(report._id)).status, 'pending'); assert.equal(await Notification.countDocuments(), 0); assert.equal(await models.AdminAIAssessment.countDocuments({ status: 'manual', outcome: 'manual_review' }), 1);
    await assert.rejects(service.enqueueAssessment({ feature: 'reply_draft', sourceType: 'report', sourceId: String(report._id), preview: true }, String(f.admin._id)), error => error.statusCode === 410);
  });
  await clean();
  for (const excluded of ['confirmed', 'resolved', 'rejected', 'cancelled', 'no_show', 'violation']) {
    await clean();
    await t.test(`Ca ${excluded}: bỏ qua cả tác vụ mới và tác vụ tồn, giữ quy trình riêng`, async st => {
      const f = await fixture();
      const config = await configure('complaint_summary', f.admin._id, policySchema.parse({}));
      const report = await Report.create({ reporterId: f.customer._id, targetType: 'system', reportType: 'other', title: 'Báo cáo kiểm thử phạm vi', description: 'Báo cáo thuộc quy trình đã xử lý hoặc quy trình riêng.', status: ['no_show', 'violation'].includes(excluded) ? 'pending' : excluded, isCustomerNoShow: excluded === 'no_show', createdViolationId: excluded === 'violation' ? new mongoose.Types.ObjectId() : null });
      const ai = st.mock.method(provider, 'generateAdminAI', async () => { throw new Error('Không được gọi AI cho ca ngoài phạm vi.'); });
      await service.scanAutomaticSources();
      assert.equal(await models.AdminAIAssessment.countDocuments(), 0);
      await assert.rejects(service.enqueueAssessment({ feature: 'complaint_summary', sourceType: 'report', sourceId: String(report._id), preview: false }, String(f.admin._id)), error => error.statusCode === 409);
      const context = await require('../src/ai/admin/admin-ai.context').loadContext({ sourceType: 'report', sourceId: String(report._id) });
      const old = await models.AdminAIAssessment.create({ key: 'tac-vu-ton', feature: 'complaint_summary', sourceType: 'report', sourceId: String(report._id), revision: config.revision, policy: policySchema.parse({}), sourceHash: context.hash, preview: false, configuredBy: f.admin._id });
      await service.processNextAssessment();
      assert.equal(ai.mock.callCount(), 0); assert.equal((await models.AdminAIAssessment.findById(old._id)).status, 'stale');
      assert.equal((await Report.findById(report._id)).status, report.status);
    });
  }
  for (const category of ['payment', 'refund', 'service_quality', 'pricing', 'schedule', 'conduct', 'safety', 'technical', 'other']) {
    await clean();
    await t.test(`Nghiệp vụ ${category}: chỉ tiếp nhận, không tự kết thúc hay tạo vi phạm`, async st => {
      const f = await complaintFixture(st, { workflow: { category, proposedStatus: 'resolved' } });
      assert.equal(f.job.outcome, 'auto_intake', f.job.error);
      const report = await Report.findById(f.report._id);
      assert.equal(report.status, 'under_review'); assert.equal(report.resolutionNote, null); assert.equal(report.createdViolationId, null);
      await service.scanAutomaticSources(); await service.scanAutomaticSources();
      assert.equal(await models.AdminAIAssessment.countDocuments({ sourceId: String(f.report._id) }), 1);
    });
  }
  for (const scenario of ['reporter', 'provider', 'system', 'disputed', 'urgent', 'waiting', 'sensitive', 'unread_attachment', 'admin_review']) {
    await clean();
    await t.test(`Bổ sung bằng chứng: ${scenario}, đúng người cung cấp và không lặp yêu cầu`, async st => {
      const f = await complaintFixture(st, {
        report: scenario === 'waiting' ? { status: 'evidence_requested', requestedEvidenceNote: 'Yêu cầu đang chờ người gửi bổ sung.' } : scenario === 'unread_attachment' ? { evidenceFiles: [{ fileType: 'file', url: 'https://example.test/chung-tu.pdf' }] } : {},
        before: scenario === 'admin_review' ? async ({ report, admin }) => { await Report.updateOne({ _id: report._id }, { status: 'under_review', reviewedBy: admin._id, reviewedByType: 'admin' }); } : undefined,
        resolution: { disputed: scenario === 'disputed', severity: scenario === 'urgent' ? 'URGENT' : 'LOW', evidenceStatus: 'insufficient' },
        workflow: { proposedStatus: 'evidence_requested', missingEvidence: [{ owner: ['provider', 'system'].includes(scenario) ? scenario : 'reporter', description: scenario === 'sensitive' ? 'Cung cấp OTP và mật khẩu để kiểm tra.' : 'Bổ sung ảnh hiện trạng phần công việc bị lỗi.' }] },
      });
      const automatic = scenario === 'reporter';
      const updated = await Report.findById(f.report._id);
      assert.equal(updated.status, automatic || scenario === 'waiting' ? 'evidence_requested' : 'under_review', f.job.error);
      assert.equal(f.job.outcome, automatic ? 'auto_evidence_requested' : ['waiting', 'admin_review'].includes(scenario) ? 'manual_review' : 'auto_intake');
      if (automatic) { assert(updated.requestedEvidenceNote.includes('ảnh hiện trạng')); assert.equal(updated.reviewedByType, 'system'); assert.equal(updated.reviewedBy, null); }
      if (scenario === 'waiting') assert.equal(updated.requestedEvidenceNote, 'Yêu cầu đang chờ người gửi bổ sung.');
      await service.scanAutomaticSources(); await service.scanAutomaticSources();
      assert.equal(await models.AdminAIAssessment.countDocuments({ sourceId: String(f.report._id) }), 1);
    });
  }
  await clean();
  await t.test('Lỗi hệ thống không gắn đơn: Admin ghi kết quả tái hiện và kiểm tra sau khắc phục', async st => {
    const f = await complaintFixture(st, {
      report: { orderId: null, targetType: 'app', reportType: 'system_bug' },
      workflow: { category: 'technical', tasks: [{ kind: 'technical', owner: 'admin', instruction: 'Tái hiện lỗi và kiểm tra bản sửa.', completionCondition: 'Thao tác ban đầu hoạt động đúng sau khi sửa.' }] },
    });
    const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
    await decideComplaint(String(f.job._id), String(f.admin._id), { status: 'resolved', note: 'Đã tái hiện và khắc phục lỗi hiển thị, kiểm tra lại thao tác thành công.', completedTasks: [{ index: 0, evidence: 'Đã kiểm tra lại các bước tái hiện trên bản sửa và ghi nhận kết quả.' }] });
    assert.equal((await Report.findById(f.report._id)).status, 'resolved');
  });
  for (const status of ['under_review', 'evidence_requested', 'confirmed', 'rejected', 'resolved']) {
    await clean();
    await t.test(`Admin quyết định ${status}: lưu người xử lý, kết quả xác minh và chặn áp dụng hai lần`, async st => {
      const f = await complaintFixture(st);
      const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
      const decision = { status, note: 'Admin đã kiểm tra chứng từ và đối chiếu với đơn dịch vụ.', completedTasks: [{ index: 0, evidence: 'Đã đối chiếu đúng đơn và giao dịch trong hệ thống.' }] };
      await decideComplaint(String(f.job._id), String(f.admin._id), decision);
      const updated = await Report.findById(f.report._id);
      assert.equal(updated.status, status); assert.equal(String(updated.reviewedBy), String(f.admin._id));
      const assessment = await models.AdminAIAssessment.findById(f.job._id);
      assert.equal(String(assessment.adminDecision.actorId), String(f.admin._id)); assert.equal(assessment.adminDecision.completedTasks.length, 1);
      await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), decision), error => error.statusCode === 409);
      assert.equal(updated.createdViolationId, null); assert.equal(await Notification.countDocuments(), 0);
    });
  }
  for (const scenario of ['unfinished', 'missing', 'preview', 'source_changed', 'cancelled', 'locked_admin', 'rollback', 'concurrent']) {
    await clean();
    await t.test(`Chặn quyết định không hợp lệ và cạnh tranh: ${scenario}`, async st => {
      const f = await complaintFixture(st, { preview: scenario === 'preview', workflow: scenario === 'missing' ? { missingEvidence: [{ owner: 'provider', description: 'Chưa có ý kiến và chứng từ của thợ.' }] } : {} });
      const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
      const decision = { status: 'resolved', note: 'Đã đối chiếu và ghi nhận kết quả giải quyết cụ thể.', completedTasks: scenario === 'unfinished' ? [] : [{ index: 0, evidence: 'Đã kiểm tra đúng đơn, khoản tiền và chứng từ.' }] };
      if (scenario === 'source_changed') await Report.updateOne({ _id: f.report._id }, { description: 'Người gửi bổ sung thêm yêu cầu khác cần kiểm tra.' });
      if (scenario === 'cancelled') await Report.updateOne({ _id: f.report._id }, { status: 'cancelled' });
      if (scenario === 'locked_admin') await User.updateOne({ _id: f.admin._id }, { status: 'locked' });
      if (scenario === 'rollback') st.mock.method(Report.prototype, 'save', async () => { throw new Error('Lỗi lưu báo cáo giả lập'); });
      if (scenario === 'concurrent') {
        const results = await Promise.allSettled([decideComplaint(String(f.job._id), String(f.admin._id), decision), decideComplaint(String(f.job._id), String(f.admin._id), decision)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await Report.findById(f.report._id)).status, 'resolved');
      } else {
        await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), decision));
        assert.equal((await models.AdminAIAssessment.findById(f.job._id)).adminDecision, null);
        assert.notEqual((await Report.findById(f.report._id)).status, 'resolved');
      }
    });
  }
  for (const status of ['requested', 'requesting', 'pending', 'failed', 'manual_review', 'succeeded']) {
    await clean();
    await t.test(`Hoàn tiền ${status}: chỉ kết thúc khi có xác nhận hoàn tất, không tự chuyển tiền`, async st => {
      const { Refund } = require('../src/models/refund.model');
      const { Payment } = require('../src/models/payment.model');
      const f = await complaintFixture(st, {
        workflow: { category: 'refund', tasks: [{ kind: 'refund', owner: 'admin', instruction: 'Kiểm tra khoản hoàn đã thực hiện.', completionCondition: 'Khoản hoàn được hệ thống xác nhận thành công.' }] },
        before: async ({ orderId, customer }) => {
          const payment = await Payment.create({ orderId, customerId: customer._id, amount: 50000, method: 'payos', paymentType: 'full', status: 'refunded' });
          await Refund.create({ paymentId: payment._id, orderId, customerId: customer._id, amount: 50000, reason: 'Hoàn theo quyết định xử lý.', referenceId: `test-${orderId}`, channel: 'payos_payout', destination: 'source_account', status, completedAt: status === 'succeeded' ? new Date() : null });
        },
      });
      const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
      const decision = { status: 'resolved', note: 'Admin xác minh khoản hoàn đúng đơn và đúng số tiền.', completedTasks: [{ index: 0, evidence: 'Đã kiểm tra trạng thái khoản hoàn trong hệ thống.' }] };
      if (status === 'succeeded') await decideComplaint(String(f.job._id), String(f.admin._id), decision);
      else await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), decision), error => error.statusCode === 422);
      assert.equal((await Report.findById(f.report._id)).status, status === 'succeeded' ? 'resolved' : 'under_review');
      assert.equal(await Refund.countDocuments(), 1); assert.equal((await Refund.findOne()).status, status);
    });
  }
  await clean();
  for (const scenario of ['success', 'pending', 'failed', 'wrong_user', 'wrong_payment', 'outflow', 'overpaid', 'large_amount']) {
    await clean();
    await t.test(`Đối soát hoàn ví ${scenario}: đúng người, đúng khoản trả và đúng chiều tiền`, async st => {
      const { Payment } = require('../src/models/payment.model');
      const { WalletTransaction } = require('../src/models/walletTransaction.model');
      const f = await complaintFixture(st, {
        workflow: { category: 'refund', tasks: [{ kind: 'refund', owner: 'admin', instruction: 'Đối soát khoản hoàn vào ví.', completionCondition: 'Giao dịch đúng khoản trả, đúng người nhận và thành công.' }] },
        before: async ({ orderId, customer }) => {
          const amount = scenario === 'large_amount' ? 100000000 : 50000;
          const payment = await Payment.create({ orderId, customerId: customer._id, amount, method: 'wallet', paymentType: 'full', status: 'refunded' });
          await WalletTransaction.create({ walletId: new mongoose.Types.ObjectId(), userId: scenario === 'wrong_user' ? new mongoose.Types.ObjectId() : customer._id, relatedOrderId: orderId, relatedPaymentId: scenario === 'wrong_payment' ? new mongoose.Types.ObjectId() : payment._id, type: 'refund', direction: scenario === 'outflow' ? 'out' : 'in', amount: scenario === 'overpaid' ? 60000 : amount, balanceAfter: amount, status: ['pending', 'failed'].includes(scenario) ? scenario : 'success' });
        },
      });
      const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
      const decision = { status: 'resolved', note: 'Đã kiểm tra tiền hoàn vào ví và đối chiếu đơn.', completedTasks: [{ index: 0, evidence: 'Đã đối chiếu đúng khoản thanh toán và người nhận.' }] };
      if (['success', 'large_amount'].includes(scenario)) await decideComplaint(String(f.job._id), String(f.admin._id), decision);
      else await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), decision), error => error.statusCode === 422);
      assert.equal((await Report.findById(f.report._id)).status, ['success', 'large_amount'].includes(scenario) ? 'resolved' : 'under_review');
      if (scenario === 'large_amount') {
        const context = await require('../src/ai/admin/admin-ai.context').loadContext({ sourceType: 'report', sourceId: String(f.report._id) });
        const wallet = JSON.parse(context.sources.find(source => source.id.startsWith('wallet_transaction:')).text);
        assert.equal(wallet.amount, 100000000); assert.equal(wallet.balanceAfter, undefined);
      }
      assert.equal(await WalletTransaction.countDocuments(), 1);
    });
  }
  await clean();
  for (const channel of [null, 'handigo_wallet']) {
    await clean();
    await t.test(`Khoản hoàn ghi thành công nhưng kênh ${channel} thiếu bằng chứng nhận tiền: không kết thúc`, async st => {
      const { Refund } = require('../src/models/refund.model');
      const { Payment } = require('../src/models/payment.model');
      const f = await complaintFixture(st, { workflow: { category: 'refund' }, before: async ({ orderId, customer }) => {
        const payment = await Payment.create({ orderId, customerId: customer._id, amount: 50000, method: 'payos', paymentType: 'full', status: 'refunded' });
        await Refund.create({ paymentId: payment._id, orderId, customerId: customer._id, amount: 50000, reason: 'Khoản hoàn kiểm thử.', referenceId: `kenh-${orderId}`, channel, destination: channel ? 'handigo_wallet' : null, status: 'succeeded', completedAt: new Date() });
      } });
      const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
      await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), { status: 'resolved', note: 'Cần kiểm chứng bằng chứng tiền đã tới đích nhận.', completedTasks: [{ index: 0, evidence: 'Đã xem bản ghi khoản hoàn nhưng chưa có giao dịch đích.' }] }), error => error.statusCode === 422);
    });
  }
  await clean();
  await t.test('Giao dịch thay đổi sau phân tích buộc phân tích lại, không dùng kết quả cũ', async st => {
    const { Payment } = require('../src/models/payment.model');
    let payment;
    const f = await complaintFixture(st, { before: async ({ orderId, customer }) => { payment = await Payment.create({ orderId, customerId: customer._id, amount: 50000, method: 'wallet', paymentType: 'full', status: 'pending' }); } });
    await Payment.updateOne({ _id: payment._id }, { status: 'paid', paidAt: new Date() }, { runValidators: true });
    const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
    await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), { status: 'under_review', note: 'Tiếp tục đối soát số tiền và trạng thái giao dịch.', completedTasks: [] }), error => error.statusCode === 409);
    assert.equal((await models.AdminAIAssessment.findById(f.job._id)).adminDecision, null);
  });
  await clean();
  await t.test('Thu thập đúng đơn hàng, tệp bằng chứng, giao dịch và chính sách; không gửi dữ liệu cổng thanh toán', async () => {
    const f = await fixture();
    const { Order } = require('../src/models/order.model');
    const { Payment } = require('../src/models/payment.model');
    const { loadContext } = require('../src/ai/admin/admin-ai.context');
    const orderId = new mongoose.Types.ObjectId();
    await Order.collection.insertOne({ _id: orderId, customerId: f.customer._id, orderCode: 'HD-KIEM-THU', status: 'completed', paymentStatus: 'paid', isDeleted: false, customerAttachments: ['https://example.test/anh.jpg'] });
    const payment = await Payment.create({ orderId, customerId: f.customer._id, amount: 50000, method: 'wallet', paymentType: 'full', status: 'paid', gatewayResponse: { privateValue: 'du-lieu-rieng-khong-gui' } });
    const report = await Report.create({ reporterId: f.customer._id, orderId, targetType: 'order', reportType: 'service_quality', title: 'Cần kiểm tra dịch vụ', description: 'Khách hàng cần đối chiếu bằng chứng', evidenceImages: ['https://example.test/bang-chung.jpg'], evidenceFiles: [{ fileType: 'file', url: 'https://example.test/hoa-don.pdf', fileName: 'hoa-don.pdf', mimeType: 'application/pdf' }] });
    const context = await loadContext({ sourceType: 'report', sourceId: String(report._id) });
    assert(context.sources.some(source => source.id === `order:${orderId}`));
    assert(context.sources.some(source => source.id === `payment:${payment._id}`));
    assert(context.sources.some(source => source.id === 'policy:warranty'));
    assert.equal(JSON.parse(context.sources.find(source => source.id === 'evidence_inventory').text).fileCount, 1);
    assert.equal(JSON.parse(context.sources.find(source => source.id === 'order_evidence_inventory').text).imageCount, 1);
    assert(!JSON.stringify(context.sources).includes('du-lieu-rieng-khong-gui'));
    await Payment.updateOne({ _id: payment._id }, { status: 'refunded' }, { runValidators: true });
    assert.notEqual((await loadContext({ sourceType: 'report', sourceId: String(report._id) })).hash, context.hash);
  });
  await clean();
  await t.test('Bỏ báo cáo vận hành khỏi cấu hình và chặn kích hoạt, chạy thử lẫn xử lý thật', async () => {
    const f = await fixture();
    assert.equal(await models.AdminAIConfig.countDocuments({ feature: 'operations_report' }), 0);
    await models.AdminAIConfig.create({ feature: 'operations_report', draft: policySchema.parse({}), policy: policySchema.parse({}), configuredBy: f.admin._id, enabled: true });
    assert.equal((await service.listConfigs()).configs.some(item => item.feature === 'operations_report'), false);
    await assert.rejects(service.changeConfig('operations_report', String(f.admin._id), 0, { enabled: true }), error => error.statusCode === 410);
    for (const preview of [true, false]) await assert.rejects(service.enqueueAssessment({ feature: 'operations_report', sourceType: 'operations', sourceId: 'operations', preview }, String(f.admin._id)), error => error.statusCode === 410);
  });
  await clean();
  await t.test('Không lên lịch hoặc gọi AI cho báo cáo cũ; giữ kết quả lịch sử', async st => {
    const f = await fixture();
    const storedPolicy = policySchema.parse({ reportHour: 0 });
    await models.AdminAIConfig.create({ feature: 'operations_report', draft: storedPolicy, policy: storedPolicy, configuredBy: f.admin._id, enabled: true });
    const payload = { feature: 'operations_report', sourceType: 'operations', sourceId: 'operations', revision: 0, policy: storedPolicy, sourceHash: 'du-lieu-cu', preview: false, configuredBy: f.admin._id };
    const old = await models.AdminAIAssessment.create({ ...payload, key: 'bao-cao-da-tao', status: 'completed', outcome: 'generated', output: { summary: 'Báo cáo lịch sử' } });
    const queued = await models.AdminAIAssessment.create({ ...payload, key: 'bao-cao-dang-cho' });
    const ai = st.mock.method(provider, 'generateAdminAI', async () => { throw new Error('Không được gọi AI báo cáo'); });
    await service.scanAutomaticSources(); await service.scanAutomaticSources();
    assert.equal(await models.AdminAIAssessment.countDocuments({ feature: 'operations_report' }), 2);
    await service.processNextAssessment();
    assert.equal(ai.mock.callCount(), 0);
    assert.equal((await models.AdminAIAssessment.findById(queued._id)).status, 'error');
    assert.equal(await service.processNextAssessment(), false);
    assert.equal((await models.AdminAIAssessment.findById(old._id)).output.summary, 'Báo cáo lịch sử');
    assert.equal(await models.AdminAIQuota.countDocuments({}), 0);
  });
  await clean();
  await t.test('Giới hạn chi phí dùng bộ đếm nguyên tử khi gọi đồng thời', async () => {
    const settled = await Promise.allSettled(Array.from({ length: 6 }, () => service.reserveCall('provider_application', 2)));
    assert.equal(settled.filter(item => item.status === 'fulfilled').length, 2); assert.equal((await models.AdminAIQuota.findOne()).count, 2);
  });
  await clean();
  await t.test('Lỗi AI thử lại có giới hạn rồi chuyển thủ công; không duyệt', async st => {
    const f = await fixture(); await configure('provider_application', f.admin._id);
    st.mock.method(provider, 'generateAdminAI', async () => { throw new AppError('Lỗi AI giả lập', 502); });
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    for (let i = 0; i < 3; i++) { await models.AdminAIAssessment.updateOne({ _id: job._id }, { nextAt: new Date(0) }); await service.processNextAssessment(); }
    const result = await models.AdminAIAssessment.findById(job._id); assert.equal(result.status, 'error'); assert.equal(result.attempts, 3); assert.equal(await Provider.countDocuments(), 0);
  });
  await clean();
  for (const feature of ['provider_application', 'service_suggestion']) for (const preview of [false, true]) for (const changed of ['source', 'config']) {
    await clean();
    await t.test(`${feature}: ${preview ? 'chạy thử' : 'duyệt tay'} báo stale khi ${changed} đổi trong lúc AI chạy`, async st => {
      const f = await fixture();
      const cfg = await configure(feature, f.admin._id);
      const source = feature === 'provider_application' ? f.application : await ServiceSuggestion.create({ providerId: new mongoose.Types.ObjectId(),
        suggestionType: 'service', suggestedServiceName: 'Dịch vụ thử nghiệm', description: 'Mô tả đủ dài để kiểm tra nội dung đề xuất', categoryId: f.category._id });
      mockAI(st, async output => {
        output.checks[0].status = 'unknown';
        if (changed === 'config') await service.changeConfig(feature, String(f.admin._id), cfg.revision, { enabled: false });
        else await (feature === 'provider_application' ? ProviderApplication : ServiceSuggestion).updateOne({ _id: source._id }, { description: 'Nội dung đã đổi hoàn toàn trong lúc phân tích' });
      });
      const job = await service.enqueueAssessment({ feature, sourceType: feature, sourceId: String(source._id), preview }, String(f.admin._id));
      await service.processNextAssessment();
      assert.equal((await models.AdminAIAssessment.findById(job._id)).status, 'stale');
      assert.equal(await Provider.countDocuments(), 0);
    });
  }
  await clean();
  await t.test('Hết hạn mức chờ tới ngày UTC tiếp theo, không mất lượt retry; hạn mức mới xử lý được hồ sơ tồn', async st => {
    const f = await fixture(); mockAI(st);
    await configure('provider_application', f.admin._id, { ...policy(), dailyCallLimit: 1 });
    await service.reserveCall('provider_application', 1);
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    await service.processNextAssessment();
    const waiting = await models.AdminAIAssessment.findById(job._id);
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
    assert.equal(waiting.status, 'retry'); assert.equal(waiting.attempts, 0);
    assert.equal(waiting.nextAt.getTime(), tomorrow.getTime());
    assert.equal(await service.processNextAssessment(), false);
    // Mô phỏng sang ngày mới: có bộ đếm quota mới và đã tới lịch xử lý.
    await models.AdminAIQuota.deleteMany({});
    await models.AdminAIAssessment.updateOne({ _id: job._id }, { nextAt: new Date(0) });
    await service.processNextAssessment();
    assert.equal((await models.AdminAIAssessment.findById(job._id)).outcome, 'auto_approved');
  });
  await clean();
  await t.test('Tác vụ hết ba lượt lỗi được chạy lại nguyên tử, không reset một job đang chạy', async st => {
    const f = await fixture(); await configure('provider_application', f.admin._id);
    let failing = true;
    mockAI(st, () => { if (failing) throw new AppError('Lỗi mô hình giả lập', 502); });
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    for (let index = 0; index < 3; index++) {
      await models.AdminAIAssessment.updateOne({ _id: job._id }, { nextAt: new Date(0) });
      await service.processNextAssessment();
    }
    assert.equal((await models.AdminAIAssessment.findById(job._id)).status, 'error');
    const restarted = await Promise.all([1, 2].map(() => service.enqueueAssessment(input(f), String(f.admin._id))));
    assert.ok(restarted.every(item => String(item._id) === String(job._id) && item.status === 'queued'));
    assert.equal((await models.AdminAIAssessment.findById(job._id)).attempts, 0);
    failing = false;
    await Promise.all([service.processNextAssessment(), service.processNextAssessment()]);
    assert.equal((await models.AdminAIAssessment.findById(job._id)).outcome, 'auto_approved');
    assert.equal(await Provider.countDocuments(), 1); assert.equal(await Notification.countDocuments(), 1);
  });
  await clean();
  await t.test('Tác vụ lỗi cấu hình được chạy lại sau khi sửa kết nối, tác vụ running giữ nguyên lease', async st => {
    const f = await fixture(); await configure('provider_application', f.admin._id); mockAI(st);
    const job = await service.enqueueAssessment(input(f), String(f.admin._id));
    await models.AdminAIAssessment.updateOne({ _id: job._id }, { status: 'error', attempts: 1, error: 'Lỗi kết nối cũ' });
    const retry = await service.enqueueAssessment(input(f), String(f.admin._id));
    assert.equal(retry.status, 'queued'); assert.equal(retry.error, null);
    await models.AdminAIAssessment.updateOne({ _id: job._id }, { status: 'running', leaseToken: 'worker-dang-chay', attempts: 1 });
    const running = await service.enqueueAssessment(input(f), String(f.admin._id));
    assert.equal(running.status, 'running'); assert.equal(running.leaseToken, 'worker-dang-chay'); assert.equal(running.attempts, 1);
  });
  for (const status of ['confirmed', 'rejected', 'resolved']) {
    await clean();
    await t.test(`API báo cáo thường không đi vòng điều kiện AI để ${status}`, async st => {
      const f = await complaintFixture(st, { workflow: { category: 'refund', tasks: [{ kind: 'refund', owner: 'admin',
        instruction: 'Đối soát khoản hoàn trước khi kết thúc.', completionCondition: 'Có khoản hoàn được xác nhận.' }] } });
      const reports = require('../src/services/report.service');
      await assert.rejects(reports.reviewReport(String(f.admin._id), String(f.report._id), { status, resolutionNote: 'Ghi chú không thay thế đối soát.' }), error => error.statusCode === 409);
      assert.equal((await Report.findById(f.report._id)).status, 'under_review');
      assert.equal((await models.AdminAIAssessment.findById(f.job._id)).adminDecision, null);
      const complaints = require('../src/services/complaint.service');
      await assert.rejects(complaints.updateComplaintStatus(String(f.admin._id), String(f.report._id), { status: 'resolved', resolutionNote: 'Đóng qua API tương thích' }), error => error.statusCode === 409);
    });
  }
  await clean();
  await t.test('Quyết định trung gian tiếp tục dùng AI, giữ kiểm tra công việc và chỉ kết thúc một lần', async st => {
    const f = await complaintFixture(st);
    const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
    const intermediate = { status: 'under_review', note: 'Admin tiếp nhận để đối chiếu công việc.', completedTasks: [] };
    await decideComplaint(String(f.job._id), String(f.admin._id), intermediate);
    await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), intermediate), error => error.statusCode === 409);
    await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), { status: 'resolved', note: 'Chưa có kết quả từng việc.', completedTasks: [] }), error => error.statusCode === 422);
    const final = { status: 'resolved', note: 'Đã đối chiếu đầy đủ và ghi nhận kết quả.', completedTasks: [{ index: 0, evidence: 'Đã kiểm tra đúng dữ kiện và ghi nhận kết quả.' }] };
    await decideComplaint(String(f.job._id), String(f.admin._id), final);
    await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), final), error => error.statusCode === 409);
    assert.equal((await Report.findById(f.report._id)).status, 'resolved');
  });
  await clean();
  await t.test('Sau quyết định trung gian, giao dịch đổi vẫn bắt buộc phân tích lại', async st => {
    const f = await complaintFixture(st);
    const { decideComplaint } = require('../src/ai/admin/admin-ai.complaint-decision');
    await decideComplaint(String(f.job._id), String(f.admin._id), { status: 'under_review', note: 'Admin tiếp nhận và kiểm tra.', completedTasks: [] });
    await Report.updateOne({ _id: f.report._id }, { description: 'Người gửi bổ sung tình tiết mới.' });
    await assert.rejects(decideComplaint(String(f.job._id), String(f.admin._id), { status: 'resolved', note: 'Đã kiểm tra nhưng nguồn vừa thay đổi.',
      completedTasks: [{ index: 0, evidence: 'Kết quả xác minh cũ không còn phù hợp.' }] }), error => error.statusCode === 409);
  });
  await clean();
  await t.test('Báo cáo không dùng AI hoặc chỉ chạy thử giữ được luồng thủ công', async st => {
    const f = await complaintFixture(st, { preview: true });
    await require('../src/services/report.service').reviewReport(String(f.admin._id), String(f.report._id), { status: 'resolved', resolutionNote: 'Admin đã tự xác minh và xử lý.' });
    assert.equal((await Report.findById(f.report._id)).status, 'resolved');
  });
  await clean();
  await t.test('Mô hình lỗi trước khi lập được phương án không khóa luồng xử lý thủ công', async st => {
    const f = await complaintFixture(st, { preview: true });
    await models.AdminAIAssessment.updateOne({ _id: f.job._id }, { preview: false, status: 'error', output: null });
    await require('../src/services/report.service').reviewReport(String(f.admin._id), String(f.report._id), { status: 'resolved', resolutionNote: 'Admin đã tự xác minh và giải quyết.' });
    assert.equal((await Report.findById(f.report._id)).status, 'resolved');
  });
  await clean();
  await t.test('API kiểm tra xác thực, quyền ADMIN, input sai và không nhận kết quả AI từ client', async () => {
    const f = await fixture(); const express = require('express'); const jwt = require('jsonwebtoken');
    const previousSecret = process.env.ACCESS_TOKEN_SECRET; process.env.ACCESS_TOKEN_SECRET = 'gia-lap-chi-dung-kiem-thu-cuc-bo';
    const app = express(); app.use(express.json()); app.use('/ai/admin', require('../src/ai/admin/admin-ai.routes').default);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 400).json({ message: error.message }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/ai/admin`;
    const adminToken = jwt.sign({ id: String(f.admin._id), tokenVersion: 0 }, process.env.ACCESS_TOKEN_SECRET);
    const customerToken = jwt.sign({ id: String(f.customer._id), role: 'ADMIN', tokenVersion: 0 }, process.env.ACCESS_TOKEN_SECRET);
    try {
      assert.equal((await fetch(`${base}/configs`)).status, 401);
      assert.equal((await fetch(`${base}/configs`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
      assert.equal((await fetch(`${base}/configs`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 200);
      const drafts = await ProviderApplication.insertMany(Array.from({ length: 55 }, () => ({ userId: new mongoose.Types.ObjectId(), applicationType: 'initial', status: 'draft', description: 'Hồ sơ chưa gửi đăng ký' })));
      const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
      const decisionUrl = `${base}/assessments/${new mongoose.Types.ObjectId()}/complaint-decision`;
      const decisionBody = JSON.stringify({ status: 'resolved', note: 'Đã kiểm tra kết quả xử lý.' });
      assert.equal((await fetch(decisionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: decisionBody })).status, 401);
      assert.equal((await fetch(decisionUrl, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${customerToken}` }, body: decisionBody })).status, 403);
      assert.equal((await fetch(decisionUrl, { method: 'POST', headers, body: JSON.stringify({ status: 'confirmed', note: 'x', actorId: String(f.customer._id) }) })).status, 400);
      assert.equal((await fetch(decisionUrl, { method: 'POST', headers, body: decisionBody })).status, 409);
      const listed = await fetch(`${base}/sources?type=provider_application`, { headers });
      assert.equal(listed.status, 200);
      const listedItems = (await listed.json()).data;
      assert.deepEqual(listedItems.map(item => item.id), [String(f.application._id)]);
      assert(listedItems.every(item => item.status !== 'draft'));
      const jobsBefore = await models.AdminAIAssessment.countDocuments();
      for (const feature of ['provider_application', 'reply_draft']) {
        const blocked = await fetch(`${base}/assessments`, { method: 'POST', headers, body: JSON.stringify({ ...input(f, true), feature, sourceId: String(drafts[0]._id) }) });
        assert.equal(blocked.status, feature === 'reply_draft' ? 400 : 404);
      }
      assert.equal(await models.AdminAIAssessment.countDocuments(), jobsBefore);
      for (const status of ['pending', 'resubmitted', 'approved', 'rejected']) {
        await ProviderApplication.updateOne({ _id: f.application._id }, { $set: { status } }, { runValidators: true });
        const visible = await fetch(`${base}/sources?type=provider_application`, { headers });
        assert.deepEqual((await visible.json()).data.map(item => item.status), ['pending', 'resubmitted'].includes(status) ? [status] : []);
        const byEmail = await fetch(`${base}/sources?type=provider_application&email=${encodeURIComponent(f.customer.email.toUpperCase())}`, { headers });
        assert.equal(byEmail.status, 200);
        assert.deepEqual((await byEmail.json()).data.map(item => item.id), ['pending', 'resubmitted'].includes(status) ? [String(f.application._id)] : []);
      }
      await ProviderApplication.updateOne({ _id: f.application._id }, { $set: { status: 'pending' } }, { runValidators: true });
      await ProviderApplication.create({ userId: f.customer._id, applicationType: 'initial', status: 'draft', description: 'Bản nháp của cùng người đăng ký' });
      const otherUsers = await User.insertMany(Array.from({ length: 51 }, (_, index) => ({ email: index === 0 ? f.customer.email.replace('.test', 'Xtest') : `khac-${index}@example.test`, fullName: 'Người đăng ký khác', role: 'CUSTOMER', status: 'active' })));
      await ProviderApplication.insertMany(otherUsers.map(user => ({ userId: user._id, applicationType: 'initial', status: 'pending', description: 'Hồ sơ chờ duyệt mới hơn' })));
      const latest = await fetch(`${base}/sources?type=provider_application`, { headers });
      assert(!(await latest.json()).data.some(item => item.id === String(f.application._id)));
      const searched = await fetch(`${base}/sources?type=provider_application&email=${encodeURIComponent(` ${f.customer.email.toUpperCase()} `)}`, { headers });
      assert.equal(searched.status, 200);
      assert.deepEqual((await searched.json()).data.map(item => item.id), [String(f.application._id)]);
      const missing = await fetch(`${base}/sources?type=provider_application&email=khong-co%40example.test`, { headers });
      assert.deepEqual((await missing.json()).data, []);
      for (const email of ['khong-phai-email', '.*', '']) assert.equal((await fetch(`${base}/sources?type=provider_application&email=${encodeURIComponent(email)}`, { headers })).status, 400);
      assert.equal((await fetch(`${base}/sources?type=service_suggestion&email=${encodeURIComponent(f.customer.email)}`, { headers })).status, 400);
      assert.equal((await fetch(`${base}/sources?type=provider_application&email=${encodeURIComponent(f.customer.email)}`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
      const suggestion = await ServiceSuggestion.create({ providerId: new mongoose.Types.ObjectId(), suggestionType: 'service', suggestedServiceName: 'Dịch vụ cần xem xét', description: 'Gợi ý dịch vụ đã gửi' });
      const suggestions = await fetch(`${base}/sources?type=service_suggestion`, { headers });
      assert((await suggestions.json()).data.some(item => item.id === String(suggestion._id)));
      const invalid = await fetch(`${base}/assessments`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input(f, true), output: { approved: true } }) });
      assert.equal(invalid.status, 400);
      assert.equal((await fetch(`${base}/assessments/not-valid`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 400);
      for (const limit of ['0', '-1', '101', '1.5', 'abc']) assert.equal((await fetch(`${base}/assessments?limit=${limit}`, { headers })).status, 400);
    } finally { await new Promise(resolve => server.close(resolve)); if (previousSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = previousSecret; }
  });
});
