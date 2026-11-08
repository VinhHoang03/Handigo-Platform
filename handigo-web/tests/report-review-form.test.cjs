const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
};
const settle = () => new Promise(setImmediate);
const assessment = () => ({ _id: 'phan-tich-a', feature: 'complaint_summary', sourceType: 'report', sourceId: 'bao-cao', preview: false, status: 'manual', adminDecision: null,
  output: { missingData: [], complaintResolution: { evidenceStatus: 'sufficient', workflow: { missingEvidence: [], facts: [{ statement: 'Đã đối soát.' }],
    tasks: [{ instruction: 'Đối soát khoản thanh toán.' }] } } } });

function setup(props = {}) {
  const calls = [], busy = [], slots = [];
  let cursor = 0, updated = 0, failure;
  const file = path.resolve(__dirname, '../src/features/admin/components/cases/ReportReviewForm.tsx');
  const exports = {};
  const invoke = kind => async (...args) => { calls.push([kind, ...args]); if (failure) throw failure; };
  const mocks = {
    react: { useId: () => 'trang-thai', useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    } },
    '../../api/adminCases.api': { adminCasesApi: { reviewReport: invoke('review'), requestReportEvidence: invoke('evidence') } },
    '../../ai/adminAI.api': { adminAI: { decideComplaint: invoke('ai') } },
    '../../ai/adminAI.types': { statusLabels: { under_review: 'Đang xem xét', evidence_requested: 'Chờ bổ sung bằng chứng', confirmed: 'Xác nhận', rejected: 'Từ chối', resolved: 'Đã xử lý' } },
    '../../ai/assessmentPresentation': { readableText: text => text },
    '@/utils/apiError': { getErrorMessage: error => error.message },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: name => mocks[name] || require(name) }, { filename: file });
  const input = { reportId: 'bao-cao', onBusyChange: value => busy.push(value), onUpdated: () => { updated++; }, ...props };
  const render = () => { cursor = 0; return exports.ReportReviewForm(input); };
  const changeStatus = value => find(render(), node => node.type === 'select').props.onChange({ target: { value } });
  const write = (name, value) => find(render(), node => node.type === 'textarea' && node.props.name === name).props.onChange({ target: { value } });
  return { input, calls, busy, render, changeStatus, write, updates: () => updated, fail: error => { failure = error; },
    submit: () => render().props.onSubmit({ preventDefault() {} }), button: () => find(render(), node => node.type === 'button') };
}

test('Một form gửi yêu cầu bằng chứng qua API hiện có và đặt lại nội dung khi thành công', async () => {
  const runtime = setup();
  runtime.changeStatus('evidence_requested');
  assert.equal(runtime.button().props.disabled, true);
  runtime.write('decisionNote', 'Vui lòng bổ sung ảnh hiện trạng.');
  runtime.submit(); await settle();
  assert.deepEqual(runtime.calls, [['evidence', 'bao-cao', 'Vui lòng bổ sung ảnh hiện trạng.']]);
  assert.deepEqual(runtime.busy, [true, false]);
  assert.equal(runtime.updates(), 1);
  assert.equal(find(runtime.render(), node => node.type === 'textarea'), undefined);
});

test('Form ban đầu chỉ hiện trạng thái; chọn rồi mới mở nội dung, không mất ghi chú khi đổi lựa chọn', () => {
  const runtime = setup();
  assert.equal(find(runtime.render(), node => node.type === 'textarea'), undefined);
  assert.equal(runtime.button(), undefined);
  runtime.changeStatus('under_review'); runtime.write('decisionNote', 'Đang kiểm tra hồ sơ.');
  assert(find(runtime.render(), node => node.type === 'textarea'));
  runtime.changeStatus('');
  assert.equal(find(runtime.render(), node => node.type === 'textarea'), undefined);
  runtime.changeStatus('under_review');
  assert.equal(find(runtime.render(), node => node.type === 'textarea').props.value, 'Đang kiểm tra hồ sơ.');
});

test('Kết quả AI tự điền trạng thái và phương án, kể cả khi tải xong sau khi mở form', () => {
  const runtime = setup();
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, '');
  const plan = assessment();
  plan.output.complaintResolution.workflow.proposedStatus = 'under_review';
  plan.output.complaintResolution.recommendation = 'Đối soát khoản thanh toán tiền mặt với khách và thợ.';
  runtime.input.assessment = plan;
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, 'under_review');
  assert.equal(find(runtime.render(), node => node.props?.name === 'decisionNote').props.value, plan.output.complaintResolution.recommendation);
  assert.equal(runtime.calls.length, 0, 'Gợi ý không tự gửi quyết định.');
});

test('Yêu cầu bằng chứng được soạn theo dữ liệu cần người phản ánh bổ sung của từng hồ sơ', () => {
  const plan = assessment();
  plan.output.complaintResolution.workflow.proposedStatus = 'evidence_requested';
  plan.output.complaintResolution.workflow.missingEvidence = [
    { owner: 'reporter', description: 'Biên nhận khoản tiền mặt 150.000 đồng.' },
    { owner: 'reporter', description: 'Xác nhận thanh toán từ thợ.' },
    { owner: 'admin', description: 'Kiểm tra dữ liệu đối soát nội bộ.' },
  ];
  const runtime = setup({ assessment: plan });
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, 'evidence_requested');
  const note = find(runtime.render(), node => node.props?.name === 'decisionNote').props.value;
  assert.match(note, /Vui lòng bổ sung/); assert.match(note, /150.000/); assert.match(note, /Xác nhận thanh toán/);
  assert.doesNotMatch(note, /nội bộ/);
});

test('Admin sửa trạng thái hoặc nội dung thì lần tải lại AI không ghi đè', () => {
  const plan = assessment();
  plan.output.complaintResolution.workflow.proposedStatus = 'under_review';
  plan.output.complaintResolution.recommendation = 'Phương án do AI đề xuất.';
  const runtime = setup({ assessment: plan });
  runtime.changeStatus('evidence_requested'); runtime.write('decisionNote', 'Vui lòng gửi ảnh biên nhận thực tế.');
  const updated = assessment(); updated._id = 'phan-tich-cap-nhat';
  updated.output.complaintResolution.workflow.proposedStatus = 'resolved';
  updated.output.complaintResolution.recommendation = 'Nội dung mới của AI.';
  runtime.input.assessment = updated;
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, 'evidence_requested');
  assert.equal(find(runtime.render(), node => node.props?.name === 'decisionNote').props.value, 'Vui lòng gửi ảnh biên nhận thực tế.');
});

test('Xác nhận xong không điền lại gợi ý cũ; phương án mới được tự điền khi chưa sửa tiếp', async () => {
  const plan = assessment(); plan.output.complaintResolution.workflow.proposedStatus = 'under_review';
  plan.output.complaintResolution.recommendation = 'Đối soát chứng từ cùng các bên liên quan.';
  const runtime = setup({ assessment: plan }); runtime.submit(); await settle();
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, '');
  runtime.input.assessment = { ...plan, _id: 'phan-tich-ke-tiep' };
  assert.equal(find(runtime.render(), node => node.type === 'select').props.value, 'under_review');
});

test('Xử lý thủ công dùng một nội dung cho ghi chú và kết quả, không gọi AI', async () => {
  const runtime = setup();
  runtime.changeStatus('resolved'); runtime.write('decisionNote', 'Đã liên hệ và đối soát xong.');
  runtime.submit(); await settle();
  assert.deepEqual(runtime.calls, [['review', 'bao-cao', 'resolved', 'Đã liên hệ và đối soát xong.', 'Đã liên hệ và đối soát xong.']]);
});

test('Có phương án AI hợp lệ thì dùng API quyết định AI; kết thúc cần kết quả từng công việc', async () => {
  const runtime = setup({ assessment: assessment() });
  runtime.changeStatus('resolved'); runtime.write('decisionNote', 'Đã đối soát thanh toán và xác minh với hai bên.');
  assert.equal(runtime.button().props.disabled, true);
  runtime.write('task-0', 'Đã xác nhận khoản thanh toán đúng với hai bên.');
  assert.equal(runtime.button().props.disabled, false);
  runtime.submit(); await settle();
  assert.equal(runtime.calls.length, 1);
  assert.equal(runtime.calls[0][0], 'ai');
  assert.equal(runtime.calls[0][1], 'phan-tich-a');
  assert.equal(runtime.calls[0][2].completedTasks[0].index, 0);
  assert.match(runtime.calls[0][2].completedTasks[0].evidence, /Đã xác nhận/);
});

test('Thiếu bằng chứng AI không cho kết luận; lỗi API giữ nội dung và không tự chuyển sang xử lý thủ công', async () => {
  const plan = assessment(); plan.output.missingData = ['Chưa có chứng từ.'];
  const runtime = setup({ assessment: plan });
  runtime.changeStatus('confirmed'); runtime.write('decisionNote', 'Nội dung xác minh của quản trị viên.');
  assert.equal(runtime.button().props.disabled, true);
  runtime.submit(); await settle(); assert.equal(runtime.calls.length, 0);
  runtime.changeStatus('under_review'); runtime.fail(Error('Dữ liệu nguồn đã thay đổi.'));
  runtime.submit(); await settle();
  assert.equal(runtime.calls[0][0], 'ai'); assert.equal(runtime.calls.length, 1);
  assert.equal(find(runtime.render(), node => node.type === 'textarea').props.value, 'Nội dung xác minh của quản trị viên.');
  assert.match(find(runtime.render(), node => node.props?.role === 'alert').props.children, /đã thay đổi/);
});

test('Chạy thử hoặc phân tích của báo cáo khác không được dùng để áp dụng quyết định AI', async () => {
  for (const plan of [{ ...assessment(), preview: true }, { ...assessment(), sourceId: 'bao-cao-khac' }]) {
    const runtime = setup({ assessment: plan }); runtime.changeStatus('under_review'); runtime.submit(); await settle();
    assert.equal(runtime.calls[0][0], 'review'); assert.equal(runtime.calls[0][1], 'bao-cao');
  }
});

test('Không dùng lại kết quả công việc của phương án cũ cho phương án AI mới', () => {
  const runtime = setup({ assessment: assessment() });
  runtime.changeStatus('resolved'); runtime.write('decisionNote', 'Đã kiểm tra lại hồ sơ và kết quả.');
  runtime.write('task-0', 'Đã đối soát khoản thanh toán thành công.');
  assert.equal(runtime.button().props.disabled, false);
  runtime.input.assessment = { ...assessment(), _id: 'phan-tich-moi' };
  assert.equal(runtime.button().props.disabled, true);
  assert.equal(find(runtime.render(), node => node.props?.name === 'task-0').props.value, '');
});

test('Khách vắng mặt giữ lựa chọn hỗ trợ 5.000đ, không dùng luồng khiếu nại thông thường', async () => {
  const runtime = setup({ customerNoShow: true, assessment: assessment() });
  const select = find(runtime.render(), node => node.type === 'select');
  const options = select.props.children.flat().filter(node => node?.type === 'option');
  assert(!options.some(node => ['resolved', 'evidence_requested'].includes(node.props.value)));
  assert(options.some(node => node.props.children === 'Chấp thuận và hỗ trợ 5.000đ'));
  runtime.changeStatus('confirmed'); runtime.submit(); await settle();
  assert.equal(runtime.calls[0][0], 'review');
});
