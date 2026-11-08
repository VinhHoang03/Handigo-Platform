const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
require('ts-node/register/transpile-only');
const runtime = path.join(process.env.ADMIN_AI_TEST_RUNTIME || path.join(os.tmpdir(), 'handigo-admin-ai-test-runtime'), 'node_modules');
const { MongoMemoryReplSet } = require(path.join(runtime, 'mongodb-memory-server'));
const { chromium } = require(path.join(runtime, 'playwright'));
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const provider = require('../src/ai/admin/admin-ai.provider');
const service = require('../src/ai/admin/admin-ai.service');
const User = require('../src/models/user.model').default;
const { ProviderApplication } = require('../src/models/providerApplication.model');
const { Provider } = require('../src/models/provider.model');
const { Service } = require('../src/models/service.model');
const { Category } = require('../src/models/category.model');

test('Tự động hóa tại từng trang: cấu hình, chạy thử, tự duyệt và modal trên màn hình nhỏ', { timeout: 120000 }, async t => {
  const paymentKeys = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
  const previousPayment = paymentKeys.map(key => process.env[key]);
  paymentKeys.forEach(key => { process.env[key] = 'gia-lap-khong-goi-thanh-toan'; });
  t.after(() => paymentKeys.forEach((key, index) => { if (previousPayment[index] === undefined) delete process.env[key]; else process.env[key] = previousPayment[index]; }));
  const previousKey = process.env.ADMIN_AI_API_KEY, previousSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ADMIN_AI_API_KEY = 'khoa-kiem-thu-giao-dien'; process.env.ACCESS_TOKEN_SECRET = 'khoa-jwt-kiem-thu-giao-dien-cuc-bo';
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  let server, browser;
  t.after(async () => {
    await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await replica.stop();
    if (previousKey === undefined) delete process.env.ADMIN_AI_API_KEY; else process.env.ADMIN_AI_API_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = previousSecret;
  });
  await mongoose.connect(replica.getUri(), { dbName: 'handigo_admin_ai_browser_test' });
  await service.initializeAdminAI();
  const admin = await User.create({ email: 'admin-ui@example.test', fullName: 'Nguyễn Văn An', role: 'ADMIN', status: 'active' });
  const customer = await User.create({ email: 'tho-ui@example.test', fullName: 'Trần Văn Bình', role: 'CUSTOMER', status: 'active' });
  const category = await Category.create({ name: 'Gia dụng', slug: 'gia-dung' });
  const catalog = await Service.create({ categoryId: category._id, name: 'Sửa điện', slug: 'sua-dien', serviceType: 'variable_price', depositAmount: 50000 });
  const application = await ProviderApplication.create({ userId: customer._id, description: 'Có kinh nghiệm sửa điện dân dụng nhiều năm', experienceYears: 3, serviceIds: [catalog._id], identityDocument: { type: 'cccd', frontImageUrl: 'https://example.test/front.png', backImageUrl: 'https://example.test/back.png' } });
  t.mock.method(provider, 'generateAdminAI', async (feature, policy, sources) => {
    const evidence = [{ sourceId: sources[0].id, quote: sources[0].text.slice(0, 40) }];
    const imageAnalyses = sources.filter(source => source.imageUrl).map(source => ({ sourceId: source.id, status: 'analyzed', relevant: true, consistent: true, observations: ['Ảnh hồ sơ rõ ràng, phù hợp nội dung đã khai.'], uncertainties: [] }));
    const output = { summary: 'Hồ sơ phù hợp tiêu chí thử nghiệm.', checks: policy.criteria.filter(rule => rule.kind === 'ai').map(rule => ({ code: rule.code, status: 'pass', reason: 'Mô tả phù hợp dịch vụ đăng ký.', evidence })), evidence, categoryId: null, normalizedName: null, normalizedDescription: null, duplicateServiceIds: [], classification: null, draftReply: null, timeline: [], missingData: [], imageAnalyses };
    if (feature === 'complaint_summary') {
      const order = sources.find(source => source.id.startsWith('order:'));
      const missing = sources[0].text.includes('Cần ảnh hiện trạng');
      output.evidence = [{ sourceId: order.id, quote: order.text.slice(0, 40) }];
      const policySource = sources.find(source => source.id.startsWith('policy:') && source.id !== 'policy:warranty');
      output.summary = 'Đã lập phương án kiểm tra và khắc phục chất lượng dịch vụ.';
      output.complaintResolution = { severity: 'LOW', severityReason: 'Cần kiểm tra kết quả công việc.', disputed: false, evidenceStatus: missing ? 'insufficient' : 'sufficient',
        policyFindings: [{ sourceId: policySource.id, quote: policySource.text.slice(0, 40), assessment: 'Cần kiểm tra với các bên.', applicable: 'yes' }],
        recommendation: 'Admin đối chiếu bằng chứng và xác nhận kết quả khắc phục trước khi kết thúc.', nextSteps: ['Làm việc với thợ và kiểm tra lại.'], requiresAdminApproval: true, escalationReasons: [], action: 'manual_review', resolutionNote: '', pendingActions: missing ? [] : ['service_work'],
        workflow: { category: 'service_quality', proposedStatus: missing ? 'evidence_requested' : 'under_review', allegations: ['Người gửi phản ánh phần công việc chưa đạt.'], facts: [{ statement: 'Đơn đã được ghi nhận hoàn thành.', sourceIds: [order.id] }],
          missingEvidence: missing ? [{ owner: 'reporter', description: 'Bổ sung ảnh hiện trạng phần công việc bị lỗi.' }] : [],
          tasks: [{ kind: missing ? 'verify' : 'service_work', owner: 'admin', instruction: 'Kiểm tra và xác nhận kết quả khắc phục.', completionCondition: 'Có kết quả kiểm tra lại và ghi nhận ý kiến của các bên.' }] } };
    }
    return { model: 'mo-hinh-kiem-thu', usage: { inputTokens: 10, outputTokens: 10 }, output };
  });
  const app = express(); app.use(express.json()); app.use('/ai/admin', require('../src/ai/admin/admin-ai.routes').default);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 400).json({ success: false, message: error.message }));
  const dist = path.resolve(__dirname, '../../handigo-web/dist'); app.use(express.static(dist)); app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const user = { id: String(admin._id), _id: String(admin._id), fullName: admin.fullName, email: admin.email, role: 'ADMIN' };
  const token = jwt.sign({ id: String(admin._id), tokenVersion: 0 }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  await page.addInitScript(({ user, token }) => { localStorage.setItem('handigo:user', JSON.stringify(user)); sessionStorage.setItem('handigo:external-redirect-token', token); }, { user, token });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const index = url.pathname.indexOf('/ai/admin/');
    if (index >= 0) { const response = await route.fetch({ url: `${base}${url.pathname.slice(index)}${url.search}` }); return route.fulfill({ response }); }
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user } });
    if (['xhr', 'fetch'].includes(request.resourceType()) && /\/admin\/reports(?:\/|$)/.test(url.pathname)) {
      const reports = require('../src/services/report.service');
      const id = url.pathname.match(/\/admin\/reports\/([a-f\d]{24})$/)?.[1];
      return route.fulfill({ json: { success: true, data: id ? await reports.getAdminReportById(id) : await reports.getAdminReports({}) } });
    }
    if (['xhr', 'fetch'].includes(request.resourceType()) && (url.pathname.endsWith('/categories/active') || url.pathname.endsWith('/service-suggestions'))) return route.fulfill({ json: { success: true, data: [], total: 0 } });
    if (['xhr', 'fetch'].includes(request.resourceType())) return route.fulfill({ json: { success: true, data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, total: 0, unreadCount: 0, providerApplications: 0, serviceSuggestions: 0, supportTickets: 0, reports: 0 } } });
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  const { expect } = require(path.join(runtime, 'playwright/test'));
  await page.goto(`${base}/admin/ai`);
  await expect(page).toHaveURL(`${base}/admin/provider-applications`);
  await expect(page.getByRole('link', { name: 'AI quản trị', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Duyệt hồ sơ thợ', exact: true })).toBeVisible();
  const reviewButton = page.getByRole('button', { name: 'Kiểm duyệt tự động', exact: true });
  const refreshButton = page.getByRole('button', { name: 'Làm mới', exact: true });
  const reviewBounds = await reviewButton.boundingBox(), refreshBounds = await refreshButton.boundingBox();
  assert(reviewBounds.x < refreshBounds.x);
  await reviewButton.click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Danh tính được xác minh từ nguồn độc lập phía server', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Bật kiểm duyệt', exact: true })).toBeDisabled();
  const identityRule = dialog.locator('details').filter({ has: page.getByText('Danh tính được xác minh từ nguồn độc lập phía server', { exact: true }) });
  await identityRule.locator(':scope > summary').click();
  await identityRule.getByRole('button', { name: 'Xóa tiêu chí', exact: true }).click();
  await dialog.getByLabel('Hướng dẫn nghiệp vụ cho AI').fill('Đối chiếu mô tả với dịch vụ đăng ký, thiếu dữ liệu chuyển Admin.');
  await dialog.getByRole('button', { name: 'Lưu và bật kiểm duyệt', exact: true }).click();
  await expect(dialog.getByText('Tự động hóa đang bật', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await dialog.getByLabel('Chọn trong 50 trường hợp gần nhất').selectOption(String(application._id));
  let queuedResponse = page.waitForResponse(response => response.url().endsWith('/ai/admin/assessments') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Phân tích thử', exact: true }).click();
  assert.equal((await queuedResponse).status(), 202);
  await service.processNextAssessment();
  await dialog.getByRole('button', { name: 'Cấu hình', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kết quả', exact: true }).click();
  await expect(dialog.getByText('Hồ sơ phù hợp tiêu chí thử nghiệm.', { exact: true }).first()).toBeVisible();
  assert.equal((await ProviderApplication.findById(application._id)).status, 'pending');
  await dialog.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await dialog.getByLabel('Chọn trong 50 trường hợp gần nhất').selectOption(String(application._id));
  await dialog.getByText('Xử lý thật trường hợp đã chọn', { exact: true }).click();
  queuedResponse = page.waitForResponse(response => response.url().endsWith('/ai/admin/assessments') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Cho AI xử lý thật trường hợp này', exact: true }).click();
  assert.equal((await queuedResponse).status(), 202);
  await service.processNextAssessment();
  assert.equal((await ProviderApplication.findById(application._id)).status, 'approved');
  assert.equal(await Provider.countDocuments({ userId: customer._id }), 1);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(reviewButton).toBeFocused();
  await reviewButton.click();
  await expect(dialog.getByLabel('Hướng dẫn nghiệp vụ cho AI')).toHaveValue('Đối chiếu mô tả với dịch vụ đăng ký, thiếu dữ liệu chuyển Admin.');
  await dialog.getByRole('button', { name: 'Tắt tự động', exact: true }).click();
  await expect(dialog.getByText('Tự động hóa đang tắt', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(`${base}/admin/service-suggestions`);
  await expect(page.getByRole('heading', { name: 'Quản lý đề xuất dịch vụ và danh mục', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm duyệt tự động', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Mô tả đủ phạm vi công việc', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Bật kiểm duyệt', exact: true }).click();
  await expect(dialog.getByText('Tự động hóa đang bật', { exact: true })).toBeVisible();
  const { AdminAIConfig } = require('../src/ai/admin/admin-ai.models');
  const suggestionConfig = await AdminAIConfig.findOne({ feature: 'service_suggestion' }).lean();
  assert.deepEqual(suggestionConfig.policy, suggestionConfig.draft);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();

  await page.goto(`${base}/admin/cases`);
  await page.getByRole('button', { name: 'Xử lý tự động', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Điều kiện xử lý có sẵn' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Bật xử lý tự động', exact: true }).click();
  await expect(dialog.getByText('Tự động hóa đang bật', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await page.getByRole('button', { name: 'Vi phạm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xử lý tự động', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await page.getByRole('button', { name: 'Xử lý tự động', exact: true }).click();

  const output = path.join(os.tmpdir(), 'handigo-automatic-review-preview');
  require('node:fs').mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'complaint-desktop.png'), fullPage: true });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const section of ['Cấu hình', 'Chạy thử', 'Kết quả']) {
      await dialog.getByRole('button', { name: section, exact: true }).click();
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Modal ${section} không tràn ngang ở ${width}px`);
    }
    await dialog.getByRole('button', { name: 'Cấu hình', exact: true }).click();
    await page.screenshot({ path: path.join(output, `complaint-${width}.png`), fullPage: true });
  }
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/admin/provider-applications`);
  await page.getByRole('button', { name: 'Kiểm duyệt tự động', exact: true }).click();
  await expect(dialog.getByLabel('Hướng dẫn nghiệp vụ cho AI')).toBeVisible();
  await page.screenshot({ path: path.join(output, 'application-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  let failConfig = true;
  const configFailure = async route => {
    if (failConfig) { failConfig = false; return route.fulfill({ status: 500, json: { success: false, message: 'Không thể tải cấu hình kiểm thử.' } }); }
    return route.fallback();
  };
  await page.route(/\/ai\/admin\/configs$/, configFailure);
  await page.getByRole('button', { name: 'Kiểm duyệt tự động', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Không thể tải cấu hình kiểm thử.');
  await dialog.getByRole('button', { name: 'Tải lại cấu hình', exact: true }).click();
  await expect(dialog.getByLabel('Hướng dẫn nghiệp vụ cho AI')).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  const { Report } = require('../src/models/report.model');
  const { Order } = require('../src/models/order.model');
  const reporter = await User.create({ email: 'nguoi-phan-anh@example.test', fullName: 'Người phản ánh', role: 'CUSTOMER', status: 'active' });
  const orderId = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({ _id: orderId, customerId: reporter._id, orderCode: 'HD-UI-KHIEU-NAI', status: 'completed', paymentStatus: 'paid', isDeleted: false });
  for (const missing of [true, false]) {
    const report = await Report.create({ reporterId: reporter._id, reporterRole: 'CUSTOMER', orderId, targetType: 'order', reportType: 'service_quality', title: missing ? 'Cần ảnh hiện trạng' : 'Kiểm tra kết quả khắc phục', description: 'Người gửi phản ánh công việc cần được kiểm tra lại.', evidenceFiles: !missing ? [{ fileType: 'file', url: 'https://example.test/chung-tu.pdf', fileName: 'chung-tu.pdf' }, { fileType: 'video', url: 'https://example.test/hien-trang.mp4', fileName: 'hien-trang.mp4' }] : [] });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/admin/cases?tab=reports&reportId=${report._id}`);
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Phân tích và phương án xử lý', exact: true })).toBeVisible();
    queuedResponse = page.waitForResponse(response => response.url().endsWith('/ai/admin/assessments') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Phân tích khiếu nại', exact: true }).click();
    assert.equal((await queuedResponse).status(), 202);
    await service.processNextAssessment();
    await page.goto(`${base}/admin/cases?tab=reports&reportId=${report._id}`);
    const uiAssessment = await require('../src/ai/admin/admin-ai.models').AdminAIAssessment.findOne({ sourceId: String(report._id) }).lean();
    assert.equal(uiAssessment.preview, false); assert.equal(uiAssessment.status, 'manual', uiAssessment.error);
    await expect(dialog.getByRole('heading', { name: 'Công việc và điều kiện hoàn tất', exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Lời phản ánh chưa xác minh', exact: true })).toBeVisible();
    const workflowPanel = dialog.getByRole('region', { name: 'Phương án nghiệp vụ khiếu nại' });
    await page.screenshot({ path: path.join(output, 'workflow-before-decision.png'), fullPage: true });
    await workflowPanel.getByLabel('Quyết định', { exact: true }).selectOption('resolved');
    await workflowPanel.getByLabel('Căn cứ quyết định và kết quả xử lý', { exact: true }).fill('Đã làm việc với các bên và kiểm tra kết quả thực hiện.');
    await expect(workflowPanel.getByRole('button', { name: 'Xác nhận quyết định', exact: true })).toBeDisabled();
    if (missing) {
      assert.equal((await Report.findById(report._id)).status, 'evidence_requested');
      await expect(workflowPanel.getByText('Còn thiếu bằng chứng.', { exact: false })).toBeVisible();
      await workflowPanel.getByLabel(/Kết quả xác minh việc 1:/).fill('Đã đọc bằng chứng nhưng vẫn cần người gửi bổ sung.');
      await expect(workflowPanel.getByRole('button', { name: 'Xác nhận quyết định', exact: true })).toBeDisabled();
    } else {
      await expect(dialog.getByRole('link', { name: 'chung-tu.pdf Mở tài liệu gốc' })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'hien-trang.mp4 Mở video gốc' })).toBeVisible();
      assert.equal((await Report.findById(report._id)).status, 'under_review');
      await workflowPanel.getByLabel(/Kết quả xác minh việc 1:/).fill('Thợ đã khắc phục, Admin đã kiểm tra lại và ghi nhận phản hồi khách.');
      await expect(workflowPanel.getByRole('button', { name: 'Xác nhận quyết định', exact: true })).toBeEnabled();
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Phương án khiếu nại không tràn ở ${width}px`);
      await page.screenshot({ path: path.join(output, `workflow-${missing ? 'missing' : 'review'}-${width}.png`), fullPage: true });
    }
    if (!missing) {
      const decisionResponse = page.waitForResponse(response => response.url().includes('/complaint-decision') && response.request().method() === 'POST');
      await workflowPanel.getByRole('button', { name: 'Xác nhận quyết định', exact: true }).click();
      assert.equal((await decisionResponse).status(), 200);
      await expect(dialog.getByText('Admin đã áp dụng:', { exact: false })).toBeVisible();
      const finalReport = await Report.findById(report._id);
      assert.equal(finalReport.status, 'resolved'); assert.equal(String(finalReport.handledBy), String(admin._id));
    }
  }
  assert.deepEqual(errors, []);
});
