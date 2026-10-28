const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../src/features/admin/components/cases');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = ['.tsx', '.ts'].map(ext => path.join(root, name + ext)).find(file => fs.existsSync(file));
  const exports = {};
  cache.set(name, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(module) {
    if (module === './case-table-columns') return { caseDateTime: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }) };
    if (module === 'lucide-react') return { AlertCircle: () => null, CheckCircle2: () => null, HelpCircle: () => null };
    if (module === '@/components/common/Modal') return { Modal: ({ children }) => React.createElement('div', {}, children) };
    if (module.startsWith('./')) return load(module.slice(2));
    return require(module);
  } }, { filename });
  return exports;
}
const { NoShowVerificationSummary } = load('NoShowVerificationSummary');
const { NoShowReviewDetails } = load('NoShowReviewDetails');
const { CaseDetailModal } = load('CaseDetailModal');
const { getNoShowUserDescription } = load('no-show-review.utils');
const checkedAt = '2026-10-26T15:54:00.000Z';
const checks = () => ({
  location: { passed: true, distanceMeters: 98.8, radiusMeters: 200 },
  waiting: { passed: true, skippedForTesting: false, waitStartedAt: '2026-10-26T15:40:00.000Z', requiredMinutes: 10 },
  calls: { passed: true, validCount: 3, requiredCount: 3 },
  chat: { passed: true, messageCount: 1, customerReplied: false },
});
function report(overrides = {}) {
  return { _id: 'bao-cao-thu-nghiem', status: 'confirmed', reviewedByType: 'system', isCustomerNoShow: true,
    createdAt: checkedAt, description: 'Khách vắng mặt.', evidenceImages: [], evidenceFiles: [],
    resolutionNote: 'Chấp thuận hỗ trợ 5.000đ.', noShowVerification: { decision: 'auto_eligible',
      reasons: ['Bằng chứng hợp lệ.'], checkedAt, policyVersion: 'HANDIGO_NO_SHOW_AI_V4', checks: checks() }, ...overrides };
}
function details() {
  return { location: { orderAddress: 'Địa chỉ đơn', arrivalAddress: 'Địa chỉ vị trí thợ', arrivedAt: checkedAt,
    distanceMeters: 98.8, withinRadius: true, radiusMeters: 200 },
    callComparison: { expectedPhone: '0773368198', phoneSource: 'customer_account', skipWaitForTesting: false,
      waitStartedAt: '2026-10-27T01:00:00.000Z', checkedAt, validCount: 0, events: [] },
    evidence: ['arrival', 'call', 'chat'].map((imageType, index) => ({ id: `anh-${index}`, kind: index ? 'contact' : 'arrival',
      url: `https://example.com/anh-${index}.jpg`, analysisStatus: 'analyzed', callEvents: [], analysis: {
        imageType, locationText: null, phoneNumbers: [], contactAt: null, contactOutcome: 'no_response',
        providerMessage: index === 2 ? 'Tôi đã đến nơi.' : null, uncertainties: [],
      } })),
  };
}
function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => all(child, predicate));
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [...(predicate(node) ? [node] : []), ...all(node.props.children, predicate)];
}

test('Tóm tắt hồ sơ đã duyệt dùng kết quả lưu 3/3, không lấy chẩn đoán hiện tại 0/3', () => {
  const item = report({ noShowDetails: details() });
  const html = renderToStaticMarkup(React.createElement(NoShowVerificationSummary, { report: item }));
  assert.match(html, /Đã tự duyệt hỗ trợ/);
  assert.match(html, /Đủ 10 phút/);
  assert.match(html, /3 cuộc hợp lệ/);
  assert.doesNotMatch(html, /0\/3|Mốc bắt đầu|Chẩn đoán/);
});

test('Hồ sơ cũ thiếu snapshot không tự hiển thị đạt từng điều kiện từ dữ liệu hiện tại', () => {
  const item = report(); delete item.noShowVerification.checks;
  const html = renderToStaticMarkup(React.createElement(NoShowVerificationSummary, { report: item }));
  assert.equal((html.match(/Chưa lưu chi tiết/g) || []).length, 4);
  assert.doesNotMatch(html, /Đủ 10 phút|3 cuộc hợp lệ/);
  assert.match(html, /Đã tự duyệt hỗ trợ/);
});

test('Thời gian bị bỏ khi test hiển thị đúng, không gắn nhãn đủ 10 phút', () => {
  const item = report(); item.noShowVerification.checks.waiting.skippedForTesting = true;
  const html = renderToStaticMarkup(React.createElement(NoShowVerificationSummary, { report: item }));
  assert.match(html, /Đã bỏ chờ khi test/);
  assert.doesNotMatch(html, /Đủ 10 phút/);
});

test('Mỗi ảnh có nút Chi tiết riêng, dữ liệu AI không còn gom trong Chi tiết xác minh', () => {
  const tree = NoShowReviewDetails({ details: details(), report: report() });
  assert.equal(all(tree, node => node.type === 'img').length, 3);
  const sections = all(tree, node => node.type === 'details');
  assert.ok(sections.length >= 4);
  assert.ok(sections.every(node => node.props.open !== true));
  const imageButtons = all(tree, node => node.type === 'summary' && node.props['aria-label']?.startsWith('Xem chi tiết ảnh'));
  assert.equal(imageButtons.length, 3);
  assert.equal(imageButtons.map(node => node.props['aria-label']).join(','), 'Xem chi tiết ảnh 1,Xem chi tiết ảnh 2,Xem chi tiết ảnh 3');
  const generalDetails = sections.find(node => all(node, child => child.type === 'summary' && child.props.children === 'Chi tiết xác minh').length);
  const generalHtml = renderToStaticMarkup(generalDetails);
  assert.doesNotMatch(generalHtml, /Loại ảnh AI nhận diện|HANDIGO_NO_SHOW_AI_V4/);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Địa điểm/); assert.match(html, /Cuộc gọi/); assert.match(html, /Chat Handigo/);
  assert.match(html, /Chi tiết xác minh/); assert.doesNotMatch(html, /Chẩn đoán|Đối chiếu hiện tại/);
});

test('Ảnh chat Handigo và ảnh cũ không hiển thị trường số điện thoại', () => {
  for (const chatChannel of ['handigo', undefined]) {
    const data = details(); data.evidence = [data.evidence[2]];
    data.evidence[0].analysis.chatChannel = chatChannel;
    data.evidence[0].analysis.phoneNumbers = ['0900000000'];
    const html = renderToStaticMarkup(React.createElement(NoShowReviewDetails, { details: data, report: report() }));
    assert.doesNotMatch(html, /Số điện thoại:|0900000000/);
    assert.match(html, /Tôi đã đến nơi/);
  }
});

test('Ảnh được nhận diện là chat ngoài Handigo hiển thị số điện thoại trong chi tiết riêng', () => {
  const data = details(); data.evidence = [data.evidence[2]];
  data.evidence[0].analysis.chatChannel = 'external';
  data.evidence[0].analysis.phoneNumbers = ['0900000000'];
  const html = renderToStaticMarkup(React.createElement(NoShowReviewDetails, { details: data, report: report() }));
  assert.match(html, /Tin nhắn bên ngoài/);
  assert.match(html, /Số điện thoại:/);
  assert.match(html, /0900000000/);
});

test('Ảnh AI lỗi vẫn xem được ảnh gốc và lý do trong chi tiết', () => {
  const data = details(); data.evidence[1].analysisStatus = 'unavailable'; data.evidence[1].analysis = null;
  data.evidence[1].analysisFailure = { reason: 'Dịch vụ Gemini gặp lỗi', httpStatus: 503 };
  const html = renderToStaticMarkup(React.createElement(NoShowReviewDetails, { details: data, report: report() }));
  assert.match(html, /Chưa phân loại/); assert.match(html, /Dịch vụ Gemini gặp lỗi/); assert.match(html, /503/);
  assert.match(html, /https:\/\/example.com\/anh-1.jpg/);
});

test('Hồ sơ đã xử lý ẩn form xét duyệt; hồ sơ chờ vẫn có thao tác xử lý', () => {
  const props = { open: true, detailLoading: false, selected: { kind: 'report', item: report({ noShowDetails: details() }) },
    detailEvidence: [], busy: false, evidenceNote: '', nextStatus: '', reviewNote: '', resolutionNote: '' };
  const done = renderToStaticMarkup(React.createElement(CaseDetailModal, props));
  assert.doesNotMatch(done, /Xem xét báo cáo/); assert.match(done, /Tạo vi phạm/);
  assert.doesNotMatch(done, /<aside|xl:grid-cols-/);
  const doneTree = CaseDetailModal(props);
  const footerButton = all(doneTree, node => node.type === 'button' && node.props.children === 'Tạo vi phạm');
  assert.equal(footerButton.length, 1);
  const mainGrid = all(doneTree, node => node.type === 'div' && node.props.className?.includes('grid gap-6'))[0];
  const gridChildren = React.Children.toArray(mainGrid.props.children);
  assert.equal(gridChildren.at(-1).props.children.props.children, 'Tạo vi phạm');
  props.selected.item.status = 'pending';
  const pending = renderToStaticMarkup(React.createElement(CaseDetailModal, props));
  assert.match(pending, /Xem xét báo cáo/); assert.match(pending, /Chờ admin xem xét/);
  assert.match(pending, /<aside/); assert.doesNotMatch(pending, />Tạo vi phạm</);
});

test('Phần đầu chỉ hiển thị mô tả của thợ, bỏ các dòng hệ thống tự chèn', () => {
  assert.equal(getNoShowUserDescription('Khách vắng mặt.\nĐã gọi nhiều lần.\nThợ xác nhận đã gọi hoặc nhắn tin nhưng không liên hệ được khách.\nĐã đến: 2026-10-26T15:40:00Z.'),
    'Khách vắng mặt.\nĐã gọi nhiều lần.');
});
