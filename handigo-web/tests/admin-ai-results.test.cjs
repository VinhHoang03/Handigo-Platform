const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let sourceClick;
const cache = new Map();
function load(relative) {
  const file = path.resolve(__dirname, '../src/features/admin/ai', relative);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react-router-dom') return { Link: ({ to, onClick, children, ...props }) => {
      sourceClick = onClick;
      return React.createElement('a', { ...props, href: to }, children);
    } };
    if (name === './ComplaintWorkflowResult') return load('ComplaintWorkflowResult.tsx');
    if (name.endsWith('/adminAI.api')) return { adminAI: {} };
    if (name.endsWith('/adminCases.api')) return { adminCasesApi: {} };
    if (name === '@/utils/apiError') return { getErrorMessage: () => 'Không thể xử lý.' };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
  } }, { filename: file });
  return exports;
}
const presentation = load('assessmentPresentation.ts');
const { AssessmentResult } = load('AssessmentResult.tsx');
const { PolicyEditor } = load('PolicyEditor.tsx');
const sourceId = '6aeb5b31095d66dc4dd3753b';
const quote = JSON.stringify({ description: 'Sửa vòi nước và thay gioăng.', experienceYears: 5,
  identityDeclared: { type: 'cccd' }, services: [{ id: sourceId, name: 'Sửa vòi nước' }], status: 'pending' });
const item = { _id: 'luot-thu', sourceId, feature: 'provider_application', sourceType: 'provider_application', status: 'manual',
  outcome: 'manual_review', preview: false, revision: 1, createdAt: '2026-11-04T16:20:00Z', error: null,
  checks: [{ code: 'identity_images', status: 'pass', reason: 'Đã có ảnh giấy tờ.' }, { code: 'relevance', status: 'pass', reason: 'Mô tả phù hợp.' }],
  output: { summary: 'Hồ sơ cần kiểm tra.', missingData: [], imageAnalyses: [], normalizedName: null, normalizedDescription: null,
    duplicateServiceIds: [sourceId], classification: null, timeline: [{ text: 'Đã gửi hồ sơ.', sourceIds: [`provider_application:${sourceId}`] }],
    evidence: [{ sourceId: `provider_application:${sourceId}`, quote }] }, metrics: null };

test('Kết quả dùng nhãn tiếng Việt, trình bày bằng chứng và ẩn ID kỹ thuật', () => {
  const html = renderToStaticMarkup(React.createElement(AssessmentResult, { item }));
  const text = html.replace(/<[^>]*>/g, '');
  assert.match(text, /Đủ ảnh giấy tờ: Đạt/);
  assert.match(text, /Mô tả phù hợp với dịch vụ đăng ký: Đạt/);
  assert.match(text, /Mô tả: Sửa vòi nước và thay gioăng/);
  assert.match(text, /Số năm kinh nghiệm: 5 năm/);
  assert.match(text, /Căn cước công dân/);
  assert.doesNotMatch(text, /identity_images|relevance|provider_application|6aeb5b31095d66dc4dd3753b|"description"|\{"/);
});

test('Mở đúng công việc gốc và gọi hành động đóng hộp thoại AI', () => {
  for (const [feature, sourceType, route, parameter] of [
    ['provider_application', 'provider_application', 'provider-applications', 'applicationId'],
    ['service_suggestion', 'service_suggestion', 'service-suggestions', 'suggestionId'],
    ['complaint_summary', 'report', 'cases?tab=reports&amp;', 'reportId'],
  ]) {
    let closed = false;
    const html = renderToStaticMarkup(React.createElement(AssessmentResult, { item: { ...item, feature, sourceType }, onOpenSource: () => { closed = true; } }));
    assert(html.includes(`/admin/${route}`));
    assert(html.includes(`${parameter}=${sourceId}`));
    assert.equal(typeof sourceClick, 'function');
    sourceClick();
    assert.equal(closed, true);
  }
});

test('Bằng chứng văn bản giữ nguyên, JSON lỗi không bị in thô, nhãn cấu hình được ưu tiên', () => {
  assert.equal(presentation.evidenceLines('Mô tả sửa vòi nước.')[0], 'Mô tả sửa vòi nước.');
  assert.match(presentation.evidenceLines('{"description":')[0], /Vui lòng xem hồ sơ gốc/);
  assert.equal(presentation.criterionLabel({ ...item, policy: { criteria: [{ code: 'custom', description: 'Mô tả đúng phạm vi dịch vụ' }] } }, 'custom'), 'Mô tả đúng phạm vi dịch vụ');
  assert.equal(presentation.sourceLabel(`payment:${sourceId}`), 'Thanh toán');
});

test('Diễn giải KN03 bỏ ngoặc rỗng sau khi ẩn ID và dịch tên nguồn, trạng thái thanh toán', () => {
  const summary = `Ca khiếu nại KN03 ghi nhận từ báo cáo thanh toán (report:${sourceId}) liên quan đến yêu cầu hoàn tiền 150.000 đồng cho đơn hàng đã hủy (${sourceId}). Theo dữ liệu hệ thống, thanh toán ghi nhận unpaid, tổng tiền đã trả là 0 (financial_inventory, payment_inventory). Thiếu bằng chứng thực tế về việc đã thanh toán tiền mặt.`;
  const text = presentation.readableText(summary);
  assert.match(text, /báo cáo thanh toán liên quan/);
  assert.match(text, /đơn hàng đã hủy\./);
  assert.match(text, /ghi nhận chưa thanh toán/);
  assert.match(text, /dữ liệu giao dịch tài chính, dữ liệu thanh toán/);
  assert.doesNotMatch(text, /\(\s*\)|financial_inventory|payment_inventory|unpaid|report:|[a-f\d]{24}/);
  assert.equal(presentation.readableText('Số tiền (150.000 đồng), trả qua ví (Handigo).'), 'Số tiền (150.000 đồng), trả qua ví (Handigo).');
  assert.equal(presentation.readableText('Báo cáo () và đơn hàng [ ].'), 'Báo cáo và đơn hàng.');
  assert.equal(presentation.sourceLabel('financial_inventory'), 'Dữ liệu giao dịch tài chính');
  assert.equal(presentation.sourceLabel('payment_inventory'), 'Dữ liệu thanh toán');
  const html = renderToStaticMarkup(React.createElement(AssessmentResult, { item: { ...item, output: { ...item.output, summary } } }));
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /\(\s*\)|financial_inventory|payment_inventory|unpaid/);
});

test('Căn cứ chính sách trình bày tên chức năng thanh toán bằng tiếng Việt và giữ trích dẫn gốc', () => {
  const { EvidenceContent } = load('EvidenceContent.tsx');
  for (const tool of ['get_payment_status', '`get_payment_status`']) {
    const quote = `Khi khách báo đã trả tiền, phải dùng ${tool} để kiểm tra; không xem lời nói hoặc ảnh chụp là xác nhận thanh toán.`;
    const html = renderToStaticMarkup(React.createElement(EvidenceContent, { quote }));
    assert.match(html, /phải dùng chức năng kiểm tra trạng thái thanh toán để kiểm tra/);
    assert.doesNotMatch(html, /get_payment_status|`/);
    assert(quote.includes(tool));
  }
});

test('Khiếu nại mặc định chỉ hiện tóm tắt, việc cần làm và quyết định; thông tin đầy đủ nằm trong chi tiết đóng', () => {
  const complaint = { ...item, feature: 'complaint_summary', sourceType: 'report', output: { ...item.output,
    summary: 'Nội dung tóm tắt khiếu nại.', complaintResolution: {
      workflow: { category: 'refund', proposedStatus: 'under_review', allegations: ['Lời phản ánh riêng để đối chiếu.'],
        facts: [{ statement: 'Dữ kiện riêng từ đơn hàng.', sourceIds: ['order:don'] }], missingEvidence: [],
        tasks: [{ kind: 'verify', owner: 'admin', instruction: 'Đối soát giao dịch với khách và thợ.', completionCondition: 'Có kết quả đối soát được ghi nhận.' }] },
      severity: 'LOW', severityReason: 'Lý do mức độ nghiêm trọng.', evidenceStatus: 'sufficient', disputed: false,
      policyFindings: [{ sourceId: 'policy:refund', assessment: 'Đối chiếu quy định hoàn tiền.', quote: 'Chính sách hoàn tiền.' }],
      recommendation: 'Phương án chi tiết để tham khảo.', escalationReasons: ['Cần kiểm tra chứng từ gốc.'],
    } } };
  const html = renderToStaticMarkup(React.createElement(AssessmentResult, { item: complaint, embedded: true }));
  const visible = html.split('<details>')[0];
  assert.match(visible, /line-clamp-3/);
  assert.match(visible, /Nội dung tóm tắt khiếu nại/);
  assert.match(visible, /Việc cần làm/);
  assert.match(visible, /Đối soát giao dịch với khách và thợ/);
  assert.match(visible, /Xử lý báo cáo/);
  assert.match(visible, /Chọn trạng thái xử lý/);
  assert.match(visible, /name="decisionNote"/);
  assert.match(visible, /value="under_review" selected=""/);
  assert.match(visible, /Phương án chi tiết để tham khảo/);
  assert.doesNotMatch(visible, /Lời phản ánh riêng|Dữ kiện riêng|Chính sách hoàn tiền|Có kết quả đối soát được ghi nhận|Bằng chứng được AI sử dụng/);
  assert.match(html, /<details><summary[^>]*>Xem chi tiết<\/summary>/);
  assert.match(html, /Lời phản ánh riêng|Dữ kiện riêng|Chính sách hoàn tiền|Bằng chứng được AI sử dụng/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  const preview = renderToStaticMarkup(React.createElement(AssessmentResult, { item: { ...complaint, preview: true }, embedded: true }));
  assert.doesNotMatch(preview, /name="decisionNote"/);
  const panelFile = path.resolve(__dirname, '../src/features/admin/ai/ComplaintReviewPanel.tsx');
  const panelCode = ts.transpileModule(fs.readFileSync(panelFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const current of [complaint, { ...complaint, preview: true }, null]) {
    let index = 0;
    const states = [current, false, false, '', 0, true];
    const exports = {};
    vm.runInNewContext(panelCode, { exports, require(name) {
      if (name === 'react') return { useState: () => [states[index++], () => {}], useEffect() {} };
      if (name.endsWith('/adminAI.api')) return { adminAI: {} };
      if (name === './adminAI.types') return load('adminAI.types.ts');
      if (name === './AssessmentResult') return { AssessmentResult };
      if (name.endsWith('/ReportReviewForm')) return load('../components/cases/ReportReviewForm.tsx');
      if (name === '@/utils/apiError') return { getErrorMessage: () => '' };
      return require(name);
    } }, { filename: panelFile });
    const panel = renderToStaticMarkup(React.createElement(exports.ComplaintReviewPanel, { reportId: sourceId, active: true }));
    assert.equal((panel.match(/aria-label="Xử lý báo cáo"/g) || []).length, 1, 'Có AI, chỉ chạy thử hay chưa có phân tích đều chỉ có một form xử lý.');
    assert.doesNotMatch(panel, /Quyết định của Admin|Xem xét báo cáo/);
  }
});

test('Ẩn nút phân tích khi tự động bật; khi tắt giữ nút chạy thử cho riêng khiếu nại', () => {
  const file = path.resolve(__dirname, '../src/features/admin/ai/ComplaintReviewPanel.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [enabled, current, label] of [[true, item, null], [false, null, 'Phân tích thử'], [false, item, 'Phân tích lại']]) {
    let index = 0;
    const states = [current, false, false, '', 0, enabled];
    const exports = {};
    vm.runInNewContext(code, { exports, require(name) {
      if (name === 'react') return { useState: () => [states[index++], () => {}], useEffect() {} };
      if (name.endsWith('/adminAI.api')) return { adminAI: {} };
      if (name === './adminAI.types') return load('adminAI.types.ts');
      if (name.endsWith('/ReportReviewForm')) return { ReportReviewForm: () => null };
      if (name === './AssessmentResult') return { AssessmentResult: () => null };
      if (name === '@/utils/apiError') return { getErrorMessage: () => '' };
      return require(name);
    } }, { filename: file });
    const html = renderToStaticMarkup(React.createElement(exports.ComplaintReviewPanel, { reportId: sourceId, active: true }));
    if (label) assert(html.includes(label));
    else assert.doesNotMatch(html, /<button/);
  }
});

test('Mở hồ sơ bằng đường dẫn kể cả khi hồ sơ nằm ngoài trang danh sách hiện tại; đóng sẽ bỏ tham số', async () => {
  const file = path.resolve(__dirname, '../src/features/admin/components/applications/useAdminApplicationsController.ts');
  const exports = {};
  const effects = [], states = [], requests = [];
  const params = new URLSearchParams({ applicationId: sourceId });
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const application = { _id: sourceId, userId: { fullName: 'Thợ kiểm thử' } };
  const mocks = {
    react: { useCallback: value => value, useEffect: effect => effects.push(effect), useState: initial => {
      const index = states.length; states.push(initial);
      return [initial, value => { states[index] = value; }];
    } },
    'react-router-dom': { useSearchParams: () => [params, update => update(params)] },
    '@/components/common/Toast': { useToast: () => ({ addToast() {} }) },
    '../../api/admin.api': { adminApi: { application: async id => { requests.push(id); return application; }, categories: async () => [] } },
    '../../hooks/useAdminList': { useAdminList: () => ({ result: { items: [], pagination: { totalPages: 1 } }, loading: false, error: '', load: async () => {} }) },
    './application-summary.utils': { applicationSummaryFilters: [] },
  };
  vm.runInNewContext(code, { exports, window: { setTimeout: () => 0, clearTimeout() {} }, require: name => mocks[name] }, { filename: file });
  const controller = exports.useAdminApplicationsController();
  const cleanup = effects.map(effect => effect());
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(requests, [sourceId]);
  assert.equal(states[4], application);
  assert.equal(controller.items.length, 0);
  controller.closeModal();
  assert.equal(states[4], null);
  assert.equal(params.has('applicationId'), false);
  cleanup.forEach(dispose => dispose?.());
});

test('Quyền tự từ chối mặc định tắt, Admin phải chọn rõ; chỉ xuất hiện cho hồ sơ thợ', () => {
  const policy = { instructions: '', criteria: [], applicationTypes: ['initial'], dailyCallLimit: 20 };
  const findPermission = node => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map(findPermission).find(Boolean);
    if (node.props?.name === 'autoRejectIncompleteApplications') return node;
    return findPermission(node.props?.children);
  };
  let next;
  const fieldset = PolicyEditor({ feature: 'provider_application', value: policy, disabled: false, onChange: value => { next = value; } });
  const permission = findPermission(fieldset);
  assert.equal(permission.props.checked, false);
  permission.props.onChange({ target: { checked: true } });
  assert.equal(next.autoRejectIncompleteApplications, true);
  assert.equal(policy.autoRejectIncompleteApplications, undefined);
  assert.equal(findPermission(PolicyEditor({ feature: 'service_suggestion', value: policy, disabled: false, onChange() {} })), undefined);
  const html = renderToStaticMarkup(React.createElement(AssessmentResult, { item: { ...item, status: 'completed', outcome: 'auto_rejected' } }));
  assert.match(html, /Đã tự từ chối hồ sơ thiếu thông tin/);
  assert.match(html, /Người đăng ký có thể bổ sung và gửi lại/);
});
