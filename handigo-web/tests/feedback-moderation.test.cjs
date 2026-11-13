const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadService(api) {
  const exports = {};
  const file = path.join(__dirname, '../src/features/feedback/services/feedback.service.ts');
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Error, require: name => name === 'axios'
    ? { isAxiosError: error => error.isAxiosError === true }
    : { feedbackApi: api } });
  return exports.feedbackService;
}

for (const edit of [false, true]) {
  test(`Giữ nguyên thông báo kiểm duyệt từ backend khi ${edit ? 'sửa' : 'tạo'} đánh giá`, async () => {
    const message = 'Nội dung đã được chuyển cho quản trị viên kiểm tra ngữ cảnh.';
    const reject = async () => { throw { isAxiosError: true, response: { data: { message } } }; };
    const service = loadService({ create: reject, update: reject });
    await assert.rejects(service.save(edit ? 'danh-gia' : undefined, { orderId: 'don', rating: 1, comment: 'Bản nháp' }, []),
      error => error.message === message);
  });
}
test('Gửi lại sau khi duyệt giữ nguyên lời bình và số sao người viết chọn', async () => {
  let saved;
  const service = loadService({ create: async payload => { saved = payload; return payload; } });
  const payload = { orderId: 'don', rating: 1, comment: 'Thợ ý thức kém, không dọn dẹp', images: [] };
  await service.save(undefined, payload, []);
  assert.equal(saved.comment, payload.comment);
  assert.equal(saved.rating, 1);
});

const tick = () => new Promise(setImmediate);
function reportFixture(api, callbacks = {}) {
  const state = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { value: initial };
      return [state[index].value, next => { state[index].value = typeof next === 'function' ? next(state[index].value) : next; }];
    },
    useEffect(work, deps) {
      const index = cursor++;
      if (!state[index] || deps.some((value, key) => value !== state[index].deps[key])) {
        effects.push(() => { state[index]?.cleanup?.(); state[index] = { deps, cleanup: work() }; });
      }
    },
  };
  const filename = path.join(__dirname, '../src/features/admin/components/feedback/AdminFeedbackModerationReport.tsx');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Promise, Date, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '@/features/feedback/api/feedback.api') return { feedbackApi: api };
    if (name === '@/components/common/Toast') return { useToast: () => ({ addToast() {} }) };
    if (name === '@/utils/apiError') return { getErrorMessage: (_error, fallback) => fallback };
    return new Proxy({}, { get: () => () => null });
  } });
  return {
    render() {
      cursor = 0;
      effects = [];
      const tree = exports.AdminFeedbackModerationReport({ onClose() {}, onOpenFeedback() {}, onShowFeedback() {}, onViewHidden() {}, revision: 0, ...callbacks });
      effects.forEach(run => run());
      return tree;
    },
    unmount() { state.forEach(value => value.cleanup?.()); },
  };
}
function findNode(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = findNode(child, predicate);
    if (match) return match;
  }
  return null;
}
const reportResult = items => ({ period: { start: null, end: '2026-11-06T00:00:00Z', days: '30' },
  summary: { total: items.length, hidden: 1, blocked: 1, needsReview: 1 }, items,
  pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 } });

test('Modal báo cáo mặc định 30 ngày, mở hoặc hiện đúng đánh giá ẩn và không cho hiện nội dung bị chặn', async () => {
  const items = [
    { _id: 'duyet', kind: 'comment', content: 'Cần kiểm tra', reason: 'Chưa rõ ngữ cảnh', decision: 'review', source: 'ai',
      createdAt: '2026-11-06T00:00:00Z', status: 'pending', needsReview: true, isCurrent: true, feedback: { _id: 'danh-gia', isVisible: false, rating: 1 } },
    { _id: 'chan', kind: 'comment', content: 'Ngôn từ vi phạm', reason: 'Có từ tục', decision: 'block', source: 'rules',
      createdAt: '2026-11-06T00:00:00Z', status: 'rejected', needsReview: false, isCurrent: false },
  ];
  let shown, opened;
  const app = reportFixture({ moderationReport: async query => {
    assert.equal(query.days, '30'); assert.equal(query.view, 'attention'); return reportResult(items);
  } }, { onShowFeedback: id => { shown = id; }, onOpenFeedback: id => { opened = id; } });
  app.render(); await tick(); const tree = app.render();
  findNode(tree, node => node.type === 'button' && node.props.children === 'Hiện đánh giá').props.onClick();
  findNode(tree, node => node.type === 'button' && node.props.children === 'Xem đánh giá').props.onClick();
  assert.equal(shown, 'danh-gia'); assert.equal(opened, 'danh-gia');
  const blocked = findNode(tree, node => node.type === 'article' && findNode(node, child => child.type === 'p' && child.props.children === 'Ngôn từ vi phạm'));
  assert.equal(findNode(blocked, node => node.type === 'button'), null);
  app.unmount();
});

test('Modal báo cáo có lỗi và thử lại; phản hồi tải cũ không ghi đè kỳ mới', async () => {
  let resolveOld;
  let calls = 0;
  const app = reportFixture({ moderationReport: async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { resolveOld = resolve; });
    if (calls === 2) throw Error('Lỗi tải.');
    return reportResult([]);
  } });
  let tree = app.render(); await tick();
  findNode(tree, node => node.props?.id === 'moderation-report-period').props.onValueChange('7');
  app.render(); await tick(); tree = app.render();
  assert.ok(findNode(tree, node => node.props?.error === 'Không thể tải báo cáo kiểm duyệt.'));
  resolveOld(reportResult([])); await tick(); tree = app.render();
  const errorState = findNode(tree, node => node.props?.error === 'Không thể tải báo cáo kiểm duyệt.');
  assert.ok(errorState);
  errorState.props.onRetry(); app.render(); await tick(); tree = app.render();
  assert.equal(findNode(tree, node => node.props?.error === 'Không thể tải báo cáo kiểm duyệt.'), null);
  app.unmount();
});
